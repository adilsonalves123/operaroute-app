/** Linha de baixa vinculada à coleta que pagou — usada para restaurar ao excluir. */

export function tagColetaOrigem(coletaId: string): string {
  return `[coleta:${coletaId}]`;
}

export function tagViaColetaOrigem(coletaId: string): string {
  return `[via_coleta:${coletaId}]`;
}

export function linhaBaixaPendencia(valor: number, coletaId?: string | null): string {
  const dataStr = new Date().toLocaleDateString("pt-BR");
  const tag = coletaId ? ` ${tagColetaOrigem(coletaId)}` : "";
  return `Baixa de R$ ${valor.toFixed(2).replace(".", ",")} em ${dataStr}${tag}`;
}

export function appendLinhaBaixaPendencia(
  descricao: string | null | undefined,
  valor: number,
  coletaId?: string | null
): string {
  const linha = linhaBaixaPendencia(valor, coletaId);
  const base = (descricao ?? "").trim();
  return base ? `${base}\n${linha}` : linha;
}
