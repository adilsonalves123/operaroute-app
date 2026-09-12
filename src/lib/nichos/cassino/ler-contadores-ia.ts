import { formatContador, parseContadorInput } from "@/lib/nichos/cassino/contadores";
import { CASSINO_IA_THRESHOLDS } from "@/lib/nichos/cassino/ia-thresholds";
import { chatCompletionVision } from "@/lib/ia/openai-client";
import { z } from "zod";

export type LeituraContadoresIaResult = {
  entradaCentesimos: number;
  saidaCentesimos: number;
  entradaFormatada: string;
  saidaFormatada: string;
  confianca: number;
  score: number;
  status: "approved_ai" | "needs_review" | "rejected";
  flags: string[];
  avisos: string[];
  modelo: string;
  modelosUsados: string[];
  /** false = não aplicar na UI; operador digita */
  aplicar: boolean;
  /** true = operador precisa conferir antes de fechar a máquina */
  exigeConfirmacao: boolean;
  motivoRecusa?: string;
  divergenciaDigitos?: {
    entrada: number[];
    saida: number[];
  };
  alternativas?: {
    entrada: string[];
    saida: string[];
  };
};

const IaJsonSchema = z.object({
  entrada_digitos: z.string().optional().nullable(),
  saida_digitos: z.string().optional().nullable(),
  confianca: z.number().min(0).max(1).optional().nullable(),
  rotulo_entrada: z.string().optional().nullable(),
  rotulo_saida: z.string().optional().nullable(),
  avisos: z.array(z.string()).optional().nullable(),
  ambiguo: z.boolean().optional().nullable(),
  motivo: z.string().optional().nullable(),
});

const CONF_MIN = CASSINO_IA_THRESHOLDS.reading.confidenceMin;

function soDigitos(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function podeSugerirValores(args: { entrada: number; saida: number }) {
  return args.entrada > 0 || args.saida > 0;
}

function primeiroDigitos(...vals: string[]): string {
  for (const v of vals) {
    const d = soDigitos(v);
    if (d.length > 0) return d;
  }
  return "";
}

function montarPromptBase(entradaAnterior: number, saidaAnterior: number): string {
  return `Você lê o painel/visor de uma máquina de cassino (entrada e saída) em foto.

TAREFA: identificar os dois contadores ATUAIS e devolver JSON.

MAPA DE RÓTULOS (entrada):
ENTRADA, IN, CREDIT, CR, CREDITO, DI, DIN, TOTAL IN, IN CREDITS

MAPA DE RÓTULOS (saída):
SAIDA, SAÍDA, OUT, PAY, PAYOUT, DS, DOUT, TOTAL OUT, OUT CREDITS, PAID

ÂNCORA (leitura anterior desta máquina, formato BR):
- entrada_anterior: ${formatContador(entradaAnterior)} (digitos=${String(entradaAnterior)})
- saida_anterior: ${formatContador(saidaAnterior)} (digitos=${String(saidaAnterior)})

REGRAS:
1. Use o rótulo no painel quando estiver legível.
2. Se o rótulo for duvidoso, use a âncora: o valor novo mais próximo/plausível da entrada anterior é a ENTRADA; o outro é a SAÍDA.
3. Contadores quase nunca diminuem. Prefira valores >= anteriores.
4. Ignore valores de crédito de jogo, jackpot, data/hora, IDs e números de série.
5. Devolva só dígitos (sem ponto/vírgula). Inclua os centavos se o visor mostrar 2 casas decimais (ex.: 1.234,56 → "123456").
6. Visor LED escuro, reflexo ou foto de celular ainda assim deve ser lido se os números estiverem visíveis.
7. Preencha entrada_digitos e saida_digitos sempre que enxergar os números. Use ambiguo=true SOMENTE se não conseguir ver os dígitos.

Responda APENAS JSON:
{
  "entrada_digitos": "string",
  "saida_digitos": "string",
  "confianca": 0.0,
  "rotulo_entrada": "string|null",
  "rotulo_saida": "string|null",
  "avisos": ["string"],
  "ambiguo": false,
  "motivo": "string"
}`;
}

function montarPromptLeitura1(entradaAnterior: number, saidaAnterior: number): string {
  return `${montarPromptBase(entradaAnterior, saidaAnterior)}

PASSO EXTRA:
- Faça a leitura principal do painel inteiro.
- Se os números estiverem visíveis, preencha os dígitos mesmo com confiança média.`;
}

function montarPromptLeitura2(entradaAnterior: number, saidaAnterior: number): string {
  return `${montarPromptBase(entradaAnterior, saidaAnterior)}

PASSO EXTRA:
- Refaça a leitura do zero, como uma checagem independente.
- Revise cuidadosamente os últimos 3 dígitos de cada contador antes de responder.
- Não tente manter consistência com uma leitura anterior; valide apenas o que consegue ver.`;
}

function validarContraAnterior(
  entrada: number,
  saida: number,
  entradaAnterior: number,
  saidaAnterior: number
): string[] {
  const avisos: string[] = [];
  if (entrada < entradaAnterior) {
    avisos.push("Entrada lida menor que a anterior.");
  }
  if (saida < saidaAnterior) {
    avisos.push("Saída lida menor que a anterior.");
  }
  const limEntrada = Math.max(
    entradaAnterior * CASSINO_IA_THRESHOLDS.reading.jumpMultiplier,
    entradaAnterior + CASSINO_IA_THRESHOLDS.reading.jumpAbsoluteFloor
  );
  const limSaida = Math.max(
    saidaAnterior * CASSINO_IA_THRESHOLDS.reading.jumpMultiplier,
    saidaAnterior + CASSINO_IA_THRESHOLDS.reading.jumpAbsoluteFloor
  );
  if (entradaAnterior > 0 && entrada > limEntrada) {
    avisos.push("Salto de entrada muito alto — confira com atenção.");
  }
  if (saidaAnterior > 0 && saida > limSaida) {
    avisos.push("Salto de saída muito alto — confira com atenção.");
  }
  return avisos;
}

function compararDigitos(a: string, b: string): number[] {
  const len = Math.min(a.length, b.length);
  const diffs: number[] = [];
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) diffs.push(i);
  }
  if (a.length !== b.length) {
    for (let i = len; i < Math.max(a.length, b.length); i += 1) diffs.push(i);
  }
  return diffs;
}

/** Divergência só nos últimos dígitos — típico de OCR, não bloqueia sugestão. */
function divergenciaLeve(diffs: number[], lenA: number, lenB: number): boolean {
  if (diffs.length === 0) return true;
  const maxLen = Math.max(lenA, lenB, 1);
  return diffs.length <= 2 && diffs.every((i) => i >= maxLen - 3);
}

function registrarDivergenciaLeituras(args: {
  flags: Set<string>;
  avisos: string[];
  divergenciaEntrada: number[];
  divergenciaSaida: number[];
  entradaLen: number;
  saidaLen: number;
  entradaLen2: number;
  saidaLen2: number;
}) {
  const entradaLeve = divergenciaLeve(
    args.divergenciaEntrada,
    args.entradaLen,
    args.entradaLen2
  );
  const saidaLeve = divergenciaLeve(args.divergenciaSaida, args.saidaLen, args.saidaLen2);

  if (args.divergenciaEntrada.length === 0 && args.divergenciaSaida.length === 0) return;

  if (entradaLeve && saidaLeve) {
    args.flags.add("divergencia_leve");
    args.avisos.push(
      "Pequena diferença entre as duas leituras — confira os últimos dígitos no visor."
    );
    return;
  }

  args.flags.add("divergencia_entre_leituras");
  args.avisos.push("A segunda leitura não bateu exatamente com a primeira.");
}

function alternativasFormatadas(...valores: number[]) {
  return Array.from(
    new Set(
      valores
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => formatContador(Math.round(n)))
    )
  );
}

function classificarStatus(score: number, flags: string[], aplicarBase: boolean) {
  if (flags.includes("leitura_ambigua") || flags.includes("valores_invalidos")) {
    return "rejected" as const;
  }
  if (
    flags.includes("divergencia_entre_leituras") ||
    flags.includes("leitura_unica") ||
    flags.includes("entrada_menor_que_anterior") ||
    flags.includes("saida_menor_que_anterior") ||
    flags.includes("salto_entrada_alto") ||
    flags.includes("salto_saida_alto")
  ) {
    return "needs_review" as const;
  }
  if (!aplicarBase) {
    return "needs_review" as const;
  }
  if (score >= CASSINO_IA_THRESHOLDS.reading.scoreApprovedAi) {
    return "approved_ai" as const;
  }
  return "needs_review" as const;
}

function calcularScore(args: {
  confianca1: number;
  confianca2: number;
  flags: string[];
  divergenciaEntrada: number[];
  divergenciaSaida: number[];
}) {
  let score = Math.round(((args.confianca1 + args.confianca2) / 2) * 100);
  if (args.flags.includes("baixa_confianca")) score -= CASSINO_IA_THRESHOLDS.scoring.lowConfidencePenalty;
  if (args.flags.includes("entrada_menor_que_anterior")) score -= CASSINO_IA_THRESHOLDS.scoring.regressionPenalty;
  if (args.flags.includes("saida_menor_que_anterior")) score -= CASSINO_IA_THRESHOLDS.scoring.regressionPenalty;
  if (args.flags.includes("salto_entrada_alto")) score -= CASSINO_IA_THRESHOLDS.scoring.highJumpPenalty;
  if (args.flags.includes("salto_saida_alto")) score -= CASSINO_IA_THRESHOLDS.scoring.highJumpPenalty;
  if (args.flags.includes("divergencia_entre_leituras")) {
    score -= CASSINO_IA_THRESHOLDS.scoring.divergenceBasePenalty;
    score -=
      args.divergenciaEntrada.length * CASSINO_IA_THRESHOLDS.scoring.divergencePerDigitPenalty;
    score -=
      args.divergenciaSaida.length * CASSINO_IA_THRESHOLDS.scoring.divergencePerDigitPenalty;
  }
  if (args.flags.includes("divergencia_leve")) {
    score -= CASSINO_IA_THRESHOLDS.scoring.divergenceLevePenalty;
  }
  return Math.max(0, Math.min(100, score));
}

type LeituraOk = {
  ok: true;
  model: string;
  text: string;
  data: z.infer<typeof IaJsonSchema>;
  entradaDigitos: string;
  saidaDigitos: string;
  confianca: number;
  avisos: string[];
};

async function executarLeitura(imageDataUrl: string, prompt: string) {
  const llm = await chatCompletionVision(
    [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ],
      },
    ],
    { maxTokens: 400, temperature: 0, json: true }
  );

  if (!llm.ok) {
    return { ok: false as const, message: llm.message };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(llm.text);
  } catch {
    return { ok: false as const, message: "A IA não retornou JSON válido." };
  }

  const parsed = IaJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, message: "A IA retornou um JSON fora do formato esperado." };
  }

  const data = parsed.data;
  return {
    ok: true as const,
    model: llm.model,
    text: llm.text,
    data,
    entradaDigitos: soDigitos(data.entrada_digitos),
    saidaDigitos: soDigitos(data.saida_digitos),
    confianca: Math.max(0, Math.min(1, Number(data.confianca) || 0)),
    avisos: Array.isArray(data.avisos) ? data.avisos.map((a) => String(a)).filter(Boolean) : [],
  };
}

function motivoRevisao(score: number, flags: string[], regressao: boolean): string {
  if (regressao) {
    return "Valor menor que a leitura anterior — confira e confirme se houve reset ou manutenção.";
  }
  if (flags.includes("divergencia_entre_leituras")) {
    return "As duas leituras não bateram — confira os números no visor.";
  }
  if (flags.includes("leitura_unica")) {
    return "Só uma leitura passou — confira entrada e saída no visor.";
  }
  if (flags.includes("salto_entrada_alto") || flags.includes("salto_saida_alto")) {
    return "Salto muito alto em relação à coleta anterior — confira no visor.";
  }
  if (flags.includes("leitura_ambigua") || flags.includes("baixa_confianca")) {
    return "A foto ficou duvidosa — confira entrada e saída no visor.";
  }
  return `Confira os valores sugeridos (score ${score}/100).`;
}

/**
 * Lê entrada/saída com duas visões em paralelo (mesmo tempo de uma, checagem cruzada).
 * Nunca grava sozinho — a UI só pede confirmação quando o status não é alta confiança.
 */
export async function lerContadoresCassinoDaFoto(opts: {
  imageDataUrl: string;
  entradaAnterior: number;
  saidaAnterior: number;
}): Promise<{ ok: true; result: LeituraContadoresIaResult } | { ok: false; message: string }> {
  const [r1, r2] = await Promise.all([
    executarLeitura(
      opts.imageDataUrl,
      montarPromptLeitura1(opts.entradaAnterior, opts.saidaAnterior)
    ),
    executarLeitura(
      opts.imageDataUrl,
      montarPromptLeitura2(opts.entradaAnterior, opts.saidaAnterior)
    ),
  ]);

  if (!r1.ok && !r2.ok) {
    return { ok: false, message: r1.message || r2.message };
  }

  const leitura1: LeituraOk = r1.ok ? r1 : (r2 as LeituraOk);
  const leitura2Ok: LeituraOk = r1.ok && r2.ok ? r2 : leitura1;
  const leituraUnica = !(r1.ok && r2.ok);

  const avisos = [...leitura1.avisos, ...leitura2Ok.avisos];
  const confianca = Math.max(leitura1.confianca, leitura2Ok.confianca);
  const entradaDigitos = primeiroDigitos(leitura1.entradaDigitos, leitura2Ok.entradaDigitos);
  const saidaDigitos = primeiroDigitos(leitura1.saidaDigitos, leitura2Ok.saidaDigitos);
  const algumAmbiguo = Boolean(leitura1.data.ambiguo || leitura2Ok.data.ambiguo);

  const entrada = parseContadorInput(entradaDigitos);
  const saida = parseContadorInput(saidaDigitos);

  if (entrada <= 0 && saida <= 0) {
    const score = calcularScore({
      confianca1: leitura1.confianca,
      confianca2: leitura2Ok.confianca,
      flags: ["valores_invalidos"],
      divergenciaEntrada: [],
      divergenciaSaida: [],
    });
    return {
      ok: true,
      result: {
        entradaCentesimos: 0,
        saidaCentesimos: 0,
        entradaFormatada: "",
        saidaFormatada: "",
        confianca,
        score,
        status: "rejected",
        flags: ["valores_invalidos"],
        avisos,
        modelo: leitura1.model,
        modelosUsados: [leitura1.model, leitura2Ok.model],
        aplicar: false,
        exigeConfirmacao: true,
        motivoRecusa: "Números lidos inválidos. Digite manualmente.",
        alternativas: {
          entrada: alternativasFormatadas(entrada),
          saida: alternativasFormatadas(saida),
        },
      },
    };
  }

  const avisosValidacao = validarContraAnterior(
    entrada,
    saida,
    opts.entradaAnterior,
    opts.saidaAnterior
  );
  const todosAvisos = [...avisos, ...avisosValidacao];
  const flags = new Set<string>(["leitura_paralela"]);
  if (leituraUnica) flags.add("leitura_unica");
  if (algumAmbiguo) flags.add("leitura_ambigua");

  if (confianca < CONF_MIN || leitura2Ok.confianca < CONF_MIN) {
    flags.add("baixa_confianca");
  }

  const divergenciaEntrada = compararDigitos(entradaDigitos, leitura2Ok.entradaDigitos);
  const divergenciaSaida = compararDigitos(saidaDigitos, leitura2Ok.saidaDigitos);
  if (!leituraUnica && (divergenciaEntrada.length > 0 || divergenciaSaida.length > 0)) {
    registrarDivergenciaLeituras({
      flags,
      avisos: todosAvisos,
      divergenciaEntrada,
      divergenciaSaida,
      entradaLen: entradaDigitos.length,
      saidaLen: saidaDigitos.length,
      entradaLen2: leitura2Ok.entradaDigitos.length,
      saidaLen2: leitura2Ok.saidaDigitos.length,
    });
  }

  if (entrada < opts.entradaAnterior) flags.add("entrada_menor_que_anterior");
  if (saida < opts.saidaAnterior) flags.add("saida_menor_que_anterior");
  if (avisosValidacao.some((a) => a.includes("Salto de entrada muito alto"))) {
    flags.add("salto_entrada_alto");
  }
  if (avisosValidacao.some((a) => a.includes("Salto de saída muito alto"))) {
    flags.add("salto_saida_alto");
  }

  const regressao = entrada < opts.entradaAnterior || saida < opts.saidaAnterior;
  const score = calcularScore({
    confianca1: leitura1.confianca,
    confianca2: leitura2Ok.confianca,
    flags: Array.from(flags),
    divergenciaEntrada,
    divergenciaSaida,
  });
  const divergenciaGrave = flags.has("divergencia_entre_leituras");
  const aplicarBase =
    !divergenciaGrave &&
    !flags.has("baixa_confianca") &&
    !flags.has("leitura_ambigua");
  const status = classificarStatus(score, Array.from(flags), aplicarBase);
  const aplicar = podeSugerirValores({ entrada, saida });
  const exigeConfirmacao = status !== "approved_ai";
  const motivoRecusa = exigeConfirmacao
    ? motivoRevisao(score, Array.from(flags), regressao)
    : undefined;

  return {
    ok: true,
    result: {
      entradaCentesimos: entrada,
      saidaCentesimos: saida,
      entradaFormatada: formatContador(entrada),
      saidaFormatada: formatContador(saida),
      confianca,
      score,
      status,
      flags: Array.from(flags),
      avisos: todosAvisos,
      modelo: leitura1.model,
      modelosUsados: [leitura1.model, leitura2Ok.model],
      aplicar,
      exigeConfirmacao,
      motivoRecusa,
      divergenciaDigitos:
        divergenciaEntrada.length > 0 || divergenciaSaida.length > 0
          ? { entrada: divergenciaEntrada, saida: divergenciaSaida }
          : undefined,
      alternativas: {
        entrada: alternativasFormatadas(
          parseContadorInput(leitura1.entradaDigitos),
          parseContadorInput(leitura2Ok.entradaDigitos)
        ),
        saida: alternativasFormatadas(
          parseContadorInput(leitura1.saidaDigitos),
          parseContadorInput(leitura2Ok.saidaDigitos)
        ),
      },
    },
  };
}
