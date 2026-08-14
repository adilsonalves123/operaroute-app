const VALE_TAG_RE =
  /\[vale:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;

export function ehCategoriaVale(categoria: string): boolean {
  const c = categoria.trim().toLowerCase();
  return c === "funcionário" || c === "funcionario" || c === "vale";
}

export function montarDescricaoVale(
  userId: string,
  nome: string,
  extra: string
): string {
  const texto = extra.trim() || `Vale ${nome}`;
  return `[vale:${userId}] ${texto}`;
}

export function userIdDoVale(descricao: string | null | undefined): string | null {
  const m = String(descricao ?? "").match(VALE_TAG_RE);
  return m?.[1]?.toLowerCase() ?? null;
}

export function descricaoValeVisivel(descricao: string | null | undefined): string {
  return String(descricao ?? "").replace(VALE_TAG_RE, "").trim();
}
