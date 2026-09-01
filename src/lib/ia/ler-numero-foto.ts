import { chatCompletionVision, modeloTexto } from "@/lib/ia/openai-client";
import { formatContadorInput } from "@/lib/nichos/cassino/contadores";
import { formatMoneyInputOnBlur } from "@/lib/utils";
import { z } from "zod";

export type ModoLeituraNumeroFoto = "contador" | "moeda" | "texto";
export type ContextoLeituraNumeroFoto = "entrada" | "saida" | null;

export type LeituraNumeroFotoResult = {
  numeroRaw: string;
  numeroFormatado: string;
  confianca: number;
  rotulo: string | null;
  modelo: string;
  motivo: string | null;
};

const IaJsonSchema = z.object({
  numero: z.string().optional().nullable(),
  confianca: z.number().min(0).max(1).optional().nullable(),
  rotulo: z.string().optional().nullable(),
  motivo: z.string().optional().nullable(),
});

function soDigitos(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function formatarPorModo(raw: string, modo: ModoLeituraNumeroFoto): string {
  if (!raw) return "";
  if (modo === "contador") return formatContadorInput(raw);
  if (modo === "moeda") return formatMoneyInputOnBlur(raw);
  return raw.trim();
}

function montarPrompt(modo: ModoLeituraNumeroFoto, contexto: ContextoLeituraNumeroFoto): string {
  const base = `Você lê o número principal exibido em visor/painel/placa de equipamento (máquina de diversão, contador, medidor).

TAREFA: identificar o número mais relevante na foto e devolver JSON.

Regras:
- Foque no display numérico principal (maior, central ou com rótulo tipo ENTRADA, TOTAL, CRÉDITOS, CONTADOR).
- Ignore datas, horários, códigos de barras e números pequenos de rodapé, salvo se forem claramente a leitura pedida.
- Se houver vírgula/ponto decimal visível, preserve a parte decimal nos dígitos (ex.: 12.345,67 → numero "1234567").
- Se for contador sem casas decimais visíveis, devolva todos os dígitos lidos.
- Se ilegível ou ambíguo, numero vazio e confianca baixa.`;

  const contextoCassino =
    contexto === "entrada"
      ? `

Contexto CASSINO — leia só o contador de ENTRADA (IN, CREDIT, CR, ENTRADA, TOTAL IN).`
      : contexto === "saida"
        ? `

Contexto CASSINO — leia só o contador de SAÍDA (OUT, PAY, PAYOUT, SAÍDA, TOTAL OUT).`
        : "";

  if (modo === "moeda") {
    return `${base}

Contexto: valor em reais (R$) — dinheiro contado ou valor monetário no visor.
Campo numero: só dígitos; últimos 2 são centavos se houver formato monetário.`;
  }

  if (modo === "texto") {
    return `${base}

Contexto: número de série ou identificação alfanumérica.
Campo numero: texto exatamente como aparece (letras e números), sem espaços extras.`;
  }

  return `${base}${contextoCassino}

Contexto: leitura de contador/visor de máquina (formato brasileiro com decimais).
Campo numero: somente dígitos; trate os 2 últimos como centésimos quando houver vírgula decimal no visor.`;
}

export async function lerNumeroDaFoto(args: {
  imageDataUrl: string;
  modo: ModoLeituraNumeroFoto;
  contexto?: ContextoLeituraNumeroFoto;
  /** Recorte pequeno já marcado pelo usuário — usa modelo e imagem mais leves. */
  rapido?: boolean;
}): Promise<
  | { ok: true; result: LeituraNumeroFotoResult }
  | { ok: false; message: string }
> {
  if (args.rapido) {
    const llm = await chatCompletionVision(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Leia APENAS os dígitos visíveis neste recorte de visor. JSON: {"numero":"somente digitos","confianca":0.9}',
            },
            {
              type: "image_url",
              image_url: { url: args.imageDataUrl, detail: "low" },
            },
          ],
        },
      ],
      { maxTokens: 64, temperature: 0, json: true, model: modeloTexto() }
    );

    if (!llm.ok) {
      return { ok: false, message: llm.message };
    }

    let parsed: z.infer<typeof IaJsonSchema>;
    try {
      parsed = IaJsonSchema.parse(JSON.parse(llm.text));
    } catch {
      return { ok: false, message: "Não foi possível interpretar a leitura." };
    }

    const numeroRaw = soDigitos(parsed.numero);
    if (!numeroRaw) {
      return {
        ok: false,
        message: parsed.motivo?.trim() || "Não leu os dígitos. Marque de novo o grupo de números.",
      };
    }

    return {
      ok: true,
      result: {
        numeroRaw,
        numeroFormatado: formatarPorModo(numeroRaw, args.modo),
        confianca: Math.max(0, Math.min(1, Number(parsed.confianca ?? 0.7))),
        rotulo: parsed.rotulo?.trim() || null,
        modelo: llm.model,
        motivo: parsed.motivo?.trim() || null,
      },
    };
  }

  const prompt = montarPrompt(args.modo, args.contexto ?? null);

  const llm = await chatCompletionVision(
    [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'Leia o número principal desta foto. Responda só JSON: {"numero":"","confianca":0,"rotulo":null,"motivo":null}',
          },
          {
            type: "image_url",
            image_url: { url: args.imageDataUrl, detail: "high" },
          },
        ],
      },
    ],
    { maxTokens: 280, temperature: 0 }
  );

  if (!llm.ok) {
    return { ok: false, message: llm.message };
  }

  let parsed: z.infer<typeof IaJsonSchema>;
  try {
    parsed = IaJsonSchema.parse(JSON.parse(llm.text));
  } catch {
    return { ok: false, message: "Não foi possível interpretar a resposta da leitura." };
  }

  const numeroRaw =
    args.modo === "texto"
      ? String(parsed.numero ?? "").trim()
      : soDigitos(parsed.numero);

  if (!numeroRaw) {
    return {
      ok: false,
      message: parsed.motivo?.trim() || "Não encontramos um número legível na foto. Tente mais perto, com boa luz.",
    };
  }

  const confianca = Math.max(0, Math.min(1, Number(parsed.confianca ?? 0.5)));

  return {
    ok: true,
    result: {
      numeroRaw,
      numeroFormatado: formatarPorModo(numeroRaw, args.modo),
      confianca,
      rotulo: parsed.rotulo?.trim() || null,
      modelo: llm.model,
      motivo: parsed.motivo?.trim() || null,
    },
  };
}
