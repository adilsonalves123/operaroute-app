/** Categorias do estoque central. */

export function normalizeCategoriaEstoque(categoria: string | null | undefined): string {
  return (categoria ?? "").trim().toLowerCase();
}

export function isCategoriaPecas(categoria: string | null | undefined): boolean {
  const c = normalizeCategoriaEstoque(categoria);
  return (
    c === "pecas" ||
    c === "peças" ||
    c === "peca" ||
    c === "peça" ||
    c === "pecas de reparo" ||
    c === "peças de reparo" ||
    c === "reparo" ||
    c.includes("peca") ||
    c.includes("peça")
  );
}

export function isCategoriaConsignado(categoria: string | null | undefined): boolean {
  const c = normalizeCategoriaEstoque(categoria);
  return c === "consignado";
}

export function labelCategoriaEstoque(categoria: string | null | undefined): string {
  if (isCategoriaPecas(categoria)) return "Peças";
  if (isCategoriaConsignado(categoria)) return "Consignado";
  const c = normalizeCategoriaEstoque(categoria);
  if (c === "brinde" || c === "brindes") return "Brindes";
  return categoria?.trim() || "Brindes";
}
