export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "no_key" | "api_error"; message: string };

export function iaDisponivel(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number }
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "no_key", message: "OPENAI_API_KEY não configurada." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.35,
        max_tokens: opts?.maxTokens ?? 1400,
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

    return { ok: true, text, model };
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      message: e instanceof Error ? e.message : "Erro de rede",
    };
  }
}
