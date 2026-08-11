export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type VisionContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "low" | "high" | "auto" };
    };

export type VisionMessage = {
  role: "system" | "user" | "assistant";
  content: string | VisionContentPart[];
};

export type ChatCompletionResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "no_key" | "api_error"; message: string };

export function iaDisponivel(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Modelo do copiloto / texto (barato). */
export function modeloTexto(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Modelo de visão para leitura de painel (precisão). */
export function modeloVisao(): string {
  return process.env.OPENAI_MODEL_VISION?.trim() || "gpt-4o";
}

async function callOpenAiChat(
  messages: VisionMessage[],
  opts: {
    model: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
  }
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "no_key", message: "OPENAI_API_KEY não configurada." };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.35,
        max_tokens: opts.maxTokens ?? 1400,
        ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        ok: false,
        reason: "api_error",
        message: errBody.slice(0, 280) || `OpenAI HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, reason: "api_error", message: "Resposta vazia da IA." };
    }

    return { ok: true, text, model: opts.model };
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      message: e instanceof Error ? e.message : "Erro de rede",
    };
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number; model?: string }
): Promise<ChatCompletionResult> {
  return callOpenAiChat(messages, {
    model: opts?.model ?? modeloTexto(),
    maxTokens: opts?.maxTokens,
    temperature: opts?.temperature,
  });
}

/** Vision + JSON (leitura de contadores / painéis). */
export async function chatCompletionVision(
  messages: VisionMessage[],
  opts?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
    json?: boolean;
  }
): Promise<ChatCompletionResult> {
  return callOpenAiChat(messages, {
    model: opts?.model ?? modeloVisao(),
    maxTokens: opts?.maxTokens ?? 500,
    temperature: opts?.temperature ?? 0,
    responseFormat: opts?.json === false ? undefined : { type: "json_object" },
  });
}
