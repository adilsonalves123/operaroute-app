import { chatCompletionVision } from "@/lib/ia/openai-client";
import { z } from "zod";

const BoxSchema = z.object({
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().min(1).max(1000),
  height: z.number().min(1).max(1000),
});

const ResponseSchema = z.object({
  entrada_box: BoxSchema.optional().nullable(),
  saida_box: BoxSchema.optional().nullable(),
  confianca: z.number().min(0).max(1).optional().nullable(),
  ambiguo: z.boolean().optional().nullable(),
  motivo: z.string().optional().nullable(),
  avisos: z.array(z.string()).optional().nullable(),
});

export type CaixaNormalizada = z.infer<typeof BoxSchema>;

function montarPromptLocalizacao() {
  return `Você está localizando os contadores de ENTRADA e SAÍDA em uma foto de painel de máquina de cassino.

TAREFA:
- Identifique a área visual onde aparecem os dígitos do contador de ENTRADA.
- Identifique a área visual onde aparecem os dígitos do contador de SAÍDA.
- Devolva coordenadas NORMALIZADAS de 0 a 1000 relativas à imagem inteira.
- Cada caixa deve cobrir somente a região principal dos dígitos, com pouca margem.
- Se um contador não estiver legível/localizável, marque ambiguo=true e não invente.

MAPA DE RÓTULOS:
- entrada: ENTRADA, IN, CREDIT, CR, CREDITO, DI, DIN, TOTAL IN, IN CREDITS
- saída: SAIDA, SAÍDA, OUT, PAY, PAYOUT, DS, DOUT, TOTAL OUT, OUT CREDITS, PAID

Responda APENAS JSON:
{
  "entrada_box": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "saida_box": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "confianca": 0.0,
  "ambiguo": false,
  "motivo": "string",
  "avisos": ["string"]
}`;
}

export async function localizarContadoresCassinoNaFoto(opts: { imageDataUrl: string }) {
  const llm = await chatCompletionVision(
    [
      {
        role: "user",
        content: [
          { type: "text", text: montarPromptLocalizacao() },
          { type: "image_url", image_url: { url: opts.imageDataUrl, detail: "high" } },
        ],
      },
    ],
    { maxTokens: 450, temperature: 0, json: true }
  );

  if (!llm.ok) {
    return { ok: false as const, message: llm.message };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(llm.text);
  } catch {
    return { ok: false as const, message: "A IA não retornou JSON válido para localizar os contadores." };
  }

  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, message: "A IA retornou coordenadas fora do formato esperado." };
  }

  const data = parsed.data;
  const avisos = Array.isArray(data.avisos) ? data.avisos.map(String).filter(Boolean) : [];
  const confianca = Math.max(0, Math.min(1, Number(data.confianca) || 0));
  const entradaBox = data.entrada_box;
  const saidaBox = data.saida_box;

  if (data.ambiguo || !entradaBox || !saidaBox) {
    return {
      ok: true as const,
      result: {
        localizar: false,
        confianca,
        avisos,
        motivo:
          data.motivo?.trim() ||
          "Não foi possível localizar ENTRADA e SAÍDA com segurança nesta foto.",
        modelo: llm.model,
      },
    };
  }

  return {
    ok: true as const,
    result: {
      localizar: true,
      confianca,
      avisos,
      entradaBox,
      saidaBox,
      modelo: llm.model,
    },
  };
}
