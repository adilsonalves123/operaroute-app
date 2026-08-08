/** Impede coleta com mais furos do que há na máquina. */
export function validarQuantidadeFurosColeta(
  quantidadeFuros: number,
  furosEstoque: number | null | undefined
): string | null {
  const qtd = Math.max(0, Math.floor(quantidadeFuros || 0));
  if (qtd <= 0) return null;

  if (furosEstoque == null) return null;

  const estoque = Math.max(0, Math.floor(furosEstoque));
  if (qtd > estoque) {
    return `Furos utilizados (${qtd}) não podem ser maiores que os furos na máquina (${estoque}). Reposição ou ajuste o estoque do ponto.`;
  }

  return null;
}

export function maxFurosColetaPermitidos(
  furosEstoque: number | null | undefined
): number | null {
  if (furosEstoque == null) return null;
  return Math.max(0, Math.floor(furosEstoque));
}
