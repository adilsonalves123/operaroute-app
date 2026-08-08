/** Lê JSON de Response sem estourar em corpo vazio (Unexpected end of JSON input). */
export async function parseFetchJson<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T & { error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      error: `Servidor respondeu vazio (HTTP ${res.status}). Tente de novo.`,
    } as T & { error?: string };
  }
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {
      error: `Resposta inválida do servidor (HTTP ${res.status}).`,
    } as T & { error?: string };
  }
}
