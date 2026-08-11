import { formatContador, parseContadorInput } from "@/lib/nichos/cassino/contadores";
import { chatCompletionVision } from "@/lib/ia/openai-client";

export type LeituraContadoresIaResult = {
  entradaCentesimos: number;
  saidaCentesimos: number;
  entradaFormatada: string;
  saidaFormatada: string;
  confianca: number;
  avisos: string[];
  modelo: string;
  /** false = não aplicar na UI; operador digita */
  aplicar: boolean;
  motivoRecusa?: string;
};

type IaJson = {
  entrada_digitos?: string;
  saida_digitos?: string;
  confianca?: number;
  rotulo_entrada?: string | null;
  rotulo_saida?: string | null;
  avisos?: string[];
  ambiguo?: boolean;
  motivo?: string;
};

const CONF_MIN = 0.75;

function soDigitos(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function montarPrompt(entradaAnterior: number, saidaAnterior: number): string {
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
  const llm = await chatCompletionVision(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: montarPrompt(opts.entradaAnterior, opts.saidaAnterior),
          },
          {
            type: "image_url",
            image_url: { url: opts.imageDataUrl, detail: "high" },
          },
        ],
      },
    ],
    { maxTokens: 400, temperature: 0, json: true }
  );

  if (!llm.ok) {
    return { ok: false, message: llm.message };
  }

  let parsed: IaJson;
  try {
    parsed = JSON.parse(llm.text) as IaJson;
  } catch {
    return { ok: false, message: "A IA não retornou JSON válido." };
  }

  const avisos = Array.isArray(parsed.avisos)
    ? parsed.avisos.map((a) => String(a)).filter(Boolean)
    : [];
  const confianca = Math.max(0, Math.min(1, Number(parsed.confianca) || 0));
  const entradaDigitos = soDigitos(parsed.entrada_digitos);
  const saidaDigitos = soDigitos(parsed.saida_digitos);

  if (parsed.ambiguo || !entradaDigitos || !saidaDigitos) {
    return {
      ok: true,
      result: {
        entradaCentesimos: 0,
        saidaCentesimos: 0,
        entradaFormatada: "",
        saidaFormatada: "",
        confianca,
        avisos: avisos.length ? avisos : ["Leitura ambígua ou incompleta."],
        modelo: llm.model,
        aplicar: false,
        motivoRecusa:
          parsed.motivo?.trim() ||
          "Não foi possível identificar entrada e saída com segurança. Digite manualmente.",
      },
    };
  }

  const entrada = parseContadorInput(entradaDigitos);
  const saida = parseContadorInput(saidaDigitos);

  if (entrada <= 0 && saida <= 0) {
    return {
      ok: true,
      result: {
        entradaCentesimos: 0,
        saidaCentesimos: 0,
        entradaFormatada: "",
        saidaFormatada: "",
        confianca,
        avisos,
        modelo: llm.model,
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

  const regressao =
    entrada < opts.entradaAnterior || saida < opts.saidaAnterior;
  const aplicar = confianca >= CONF_MIN && !regressao;

  return {
    ok: true,
    result: {
      entradaCentesimos: entrada,
      saidaCentesimos: saida,
      entradaFormatada: formatContador(entrada),
      saidaFormatada: formatContador(saida),
      confianca,
      avisos: todosAvisos,
      modelo: llm.model,
      aplicar,
      motivoRecusa: aplicar
        ? undefined
        : regressao
          ? "Valor menor que a leitura anterior — confira e digite se estiver certo."
          : `Confiança baixa (${Math.round(confianca * 100)}%). Digite manualmente.`,
    },
  };
}
