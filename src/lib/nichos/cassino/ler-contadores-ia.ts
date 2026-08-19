import { formatContador, parseContadorInput } from "@/lib/nichos/cassino/contadores";
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
  motivoRecusa?: string;
  divergenciaDigitos?: {
    entrada: number[];
    saida: number[];
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

type IaJson = z.infer<typeof IaJsonSchema>;

const CONF_MIN = 0.75;
const SCORE_MIN_APLICAR = 85;

function soDigitos(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
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
6. Se houver dúvida real (ilegível, ambíguo, um só número), marque ambiguo=true e não invente.

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
- Se estiver em dúvida real, marque ambiguo=true.`;
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
  // Salto absurdo (> 50x o valor anterior + 100000) — proteção grossa
  const limEntrada = Math.max(entradaAnterior * 50, entradaAnterior + 5_000_000);
  const limSaida = Math.max(saidaAnterior * 50, saidaAnterior + 5_000_000);
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

function classificarStatus(score: number, flags: string[], aplicarBase: boolean) {
  if (!aplicarBase || flags.includes("divergencia_entre_leituras")) {
    return "rejected" as const;
  }
  if (score >= 95 && !flags.includes("salto_entrada_alto") && !flags.includes("salto_saida_alto")) {
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
  if (args.flags.includes("baixa_confianca")) score -= 18;
  if (args.flags.includes("entrada_menor_que_anterior")) score -= 45;
  if (args.flags.includes("saida_menor_que_anterior")) score -= 45;
  if (args.flags.includes("salto_entrada_alto")) score -= 12;
  if (args.flags.includes("salto_saida_alto")) score -= 12;
  if (args.flags.includes("divergencia_entre_leituras")) {
    score -= 30;
    score -= args.divergenciaEntrada.length * 5;
    score -= args.divergenciaSaida.length * 5;
  }
  return Math.max(0, Math.min(100, score));
}

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

/**
 * Lê entrada/saída de uma foto do painel via GPT-4o vision.
 * Nunca grava sozinho — a UI exige confirmação do operador.
 */
export async function lerContadoresCassinoDaFoto(opts: {
  imageDataUrl: string;
  entradaAnterior: number;
  saidaAnterior: number;
}): Promise<
  | { ok: true; result: LeituraContadoresIaResult }
  | { ok: false; message: string }
> {
  const leitura1 = await executarLeitura(
    opts.imageDataUrl,
    montarPromptLeitura1(opts.entradaAnterior, opts.saidaAnterior)
  );
  if (!leitura1.ok) {
    return { ok: false, message: leitura1.message };
  }

  const leitura2 = await executarLeitura(
    opts.imageDataUrl,
    montarPromptLeitura2(opts.entradaAnterior, opts.saidaAnterior)
  );
  if (!leitura2.ok) {
    return { ok: false, message: leitura2.message };
  }

  const avisos = [...leitura1.avisos, ...leitura2.avisos];
  const confianca = Math.max(leitura1.confianca, leitura2.confianca);
  const entradaDigitos = leitura1.entradaDigitos;
  const saidaDigitos = leitura1.saidaDigitos;

  if (
    leitura1.data.ambiguo ||
    leitura2.data.ambiguo ||
    !entradaDigitos ||
    !saidaDigitos ||
    !leitura2.entradaDigitos ||
    !leitura2.saidaDigitos
  ) {
    const score = calcularScore({
      confianca1: leitura1.confianca,
      confianca2: leitura2.confianca,
      flags: ["leitura_ambigua"],
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
        flags: ["leitura_ambigua"],
        avisos: avisos.length ? avisos : ["Leitura ambígua ou incompleta."],
        modelo: leitura1.model,
        modelosUsados: [leitura1.model, leitura2.model],
        aplicar: false,
        motivoRecusa:
          leitura1.data.motivo?.trim() ||
          leitura2.data.motivo?.trim() ||
          "Não foi possível identificar entrada e saída com segurança. Digite manualmente.",
      },
    };
  }

  const entrada = parseContadorInput(entradaDigitos);
  const saida = parseContadorInput(saidaDigitos);

  if (entrada <= 0 && saida <= 0) {
    const score = calcularScore({
      confianca1: leitura1.confianca,
      confianca2: leitura2.confianca,
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
        modelosUsados: [leitura1.model, leitura2.model],
        aplicar: false,
        motivoRecusa: "Números lidos inválidos. Digite manualmente.",
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
  const flags = new Set<string>();

  if (confianca < CONF_MIN || leitura2.confianca < CONF_MIN) {
    flags.add("baixa_confianca");
  }

  const divergenciaEntrada = compararDigitos(entradaDigitos, leitura2.entradaDigitos);
  const divergenciaSaida = compararDigitos(saidaDigitos, leitura2.saidaDigitos);
  if (divergenciaEntrada.length > 0 || divergenciaSaida.length > 0) {
    flags.add("divergencia_entre_leituras");
    todosAvisos.push("A segunda leitura não bateu exatamente com a primeira.");
  }

  if (entrada < opts.entradaAnterior) flags.add("entrada_menor_que_anterior");
  if (saida < opts.saidaAnterior) flags.add("saida_menor_que_anterior");
  if (avisosValidacao.some((a) => a.includes("Salto de entrada muito alto"))) {
    flags.add("salto_entrada_alto");
  }
  if (avisosValidacao.some((a) => a.includes("Salto de saída muito alto"))) {
    flags.add("salto_saida_alto");
  }

  const regressao =
    entrada < opts.entradaAnterior || saida < opts.saidaAnterior;
  const score = calcularScore({
    confianca1: leitura1.confianca,
    confianca2: leitura2.confianca,
    flags: Array.from(flags),
    divergenciaEntrada,
    divergenciaSaida,
  });
  const aplicarBase =
    confianca >= CONF_MIN &&
    leitura2.confianca >= CONF_MIN &&
    !regressao &&
    divergenciaEntrada.length === 0 &&
    divergenciaSaida.length === 0;
  const status = classificarStatus(score, Array.from(flags), aplicarBase);
  const aplicar = aplicarBase && score >= SCORE_MIN_APLICAR;
  const motivoRecusa = regressao
    ? "Valor menor que a leitura anterior — confira e digite se estiver certo."
    : divergenciaEntrada.length > 0 || divergenciaSaida.length > 0
      ? "Encontramos divergência entre duas leituras da IA. Confira o visor e digite manualmente."
      : score < SCORE_MIN_APLICAR
        ? `Score de segurança baixo (${score}/100). Confira e digite manualmente.`
        : `Confiança baixa (${Math.round(confianca * 100)}%). Digite manualmente.`;

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
      modelosUsados: [leitura1.model, leitura2.model],
      aplicar,
      motivoRecusa: aplicar ? undefined : motivoRecusa,
      divergenciaDigitos:
        divergenciaEntrada.length > 0 || divergenciaSaida.length > 0
          ? { entrada: divergenciaEntrada, saida: divergenciaSaida }
          : undefined,
    },
  };
}
