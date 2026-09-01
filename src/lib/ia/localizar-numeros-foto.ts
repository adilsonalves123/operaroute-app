import { chatCompletionVision } from "@/lib/ia/openai-client";
import { formatContadorInput } from "@/lib/nichos/cassino/contadores";
import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";
import { z } from "zod";

const BoxSchema = z.object({
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().min(1).max(1000),
  height: z.number().min(1).max(1000),
});

const NumeroSchema = z.object({
  id: z.string().optional().nullable(),
  numero_digitos: z.string().optional().nullable(),
  rotulo: z.string().optional().nullable(),
  tipo: z.enum(["entrada", "saida", "contador", "outro"]).optional().nullable(),
  box: BoxSchema,
  confianca: z.number().min(0).max(1).optional().nullable(),
});

const ResponseSchema = z.object({
  numeros: z.array(NumeroSchema).optional().nullable(),
  motivo: z.string().optional().nullable(),
});

export type NumeroDetectadoFoto = {
  id: string;
  numeroRaw: string;
  numeroFormatado: string;
  rotulo: string | null;
  tipo: "entrada" | "saida" | "contador" | "outro";
  box: CaixaNormalizada;
  confianca: number;
};

function soDigitos(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function montarPrompt(): string {
  return `Você analisa fotos de painéis/audit de máquinas (cassino, diversão, ursinho).

TAREFA: listar CADA grupo de dígitos de contador como uma região clicável separada.

Regras:
- Um item por bloco numérico principal (ex.: 53113900 é um item; 33134935 é outro).
- Ignore datas, versões de software e textos pequenos de rodapé.
- box: coordenadas NORMALIZADAS 0–1000 (x,y = canto superior esquerdo; width/height da caixa dos dígitos).
- numero_digitos: somente dígitos do bloco (últimos 2 = centésimos se houver vírgula decimal no visor).
- rotulo: texto próximo (ex.: "PARTIAL READING", "LIFETIME TOTAL", "ENTRADA").
- tipo:
  - "entrada" se perto de ENTRADA, IN, CREDIT, CR, DI, LIFETIME/PARTIAL da coluna de entrada
  - "saida" se perto de SAÍDA, OUT, PAY, PAYOUT, DS
  - "contador" para visor único sem rótulo claro de entrada/saída
  - "outro" para valores que não são contador principal
- Em telas TERMINAL AUDIT com duas colunas, inclua TODOS os números grandes das linhas de contadores.
- Não invente dígitos ilegíveis.

Responda APENAS JSON:
{
  "numeros": [
    {
      "id": "n1",
      "numero_digitos": "53113900",
      "rotulo": "PARTIAL READING",
      "tipo": "entrada",
      "box": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "confianca": 0.9
    }
  ],
  "motivo": null
}`;
}

export async function localizarNumerosNaFoto(imageDataUrl: string): Promise<
  | { ok: true; numeros: NumeroDetectadoFoto[] }
  | { ok: false; message: string }
> {
  const llm = await chatCompletionVision(
    [
      {
        role: "user",
        content: [
          { type: "text", text: montarPrompt() },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ],
      },
    ],
    { maxTokens: 1200, temperature: 0, json: true }
  );

  if (!llm.ok) {
    return { ok: false, message: llm.message };
  }

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    parsed = ResponseSchema.parse(JSON.parse(llm.text));
  } catch {
    return { ok: false, message: "Não foi possível interpretar os números da foto." };
  }

  const numeros: NumeroDetectadoFoto[] = [];
  for (const [index, item] of (parsed.numeros ?? []).entries()) {
    const raw = soDigitos(item.numero_digitos);
    if (!raw) continue;
    numeros.push({
      id: String(item.id ?? `n${index + 1}`),
      numeroRaw: raw,
      numeroFormatado: formatContadorInput(raw),
      rotulo: item.rotulo?.trim() || null,
      tipo: item.tipo ?? "contador",
      box: item.box,
      confianca: Math.max(0, Math.min(1, Number(item.confianca ?? 0.6))),
    });
  }

  if (!numeros.length) {
    return {
      ok: false,
      message: parsed.motivo?.trim() || "Nenhum número detectado na foto.",
    };
  }

  return { ok: true, numeros };
}
