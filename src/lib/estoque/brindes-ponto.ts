import { randomUUID } from "crypto";

export type EstoqueBrindePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

export type BrindeEntreguePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

function brindeKey(b: { item_id?: string; nome: string }): string {
  return b.item_id ?? b.nome;
}

export function normalizarEstoqueBrindesPonto(
  raw: unknown
): EstoqueBrindePonto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      item_id: typeof item?.item_id === "string" ? item.item_id : undefined,
      nome: String(item?.nome ?? "").trim(),
      quantidade: Math.max(0, Math.floor(Number(item?.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(item?.custo_unitario) || 0),
    }))
    .filter((item) => item.nome && item.quantidade > 0);
}

export function agregarBrindesEntregues(
  brindes: BrindeEntreguePonto[]
): BrindeEntreguePonto[] {
  const totals = new Map<string, BrindeEntreguePonto>();
  for (const brinde of brindes) {
    if (brinde.quantidade <= 0) continue;
    const key = brindeKey(brinde);
    const atual = totals.get(key);
    if (atual) {
      atual.quantidade += brinde.quantidade;
    } else {
      totals.set(key, { ...brinde });
    }
  }
  return Array.from(totals.values());
}

export function deduzirEstoquePonto(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntreguePonto[]
): EstoqueBrindePonto[] {
  const next = estoque.map((item) => ({ ...item }));
  for (const brinde of brindes) {
    const idx = brinde.item_id
      ? next.findIndex((item) => item.item_id === brinde.item_id)
      : next.findIndex((item) => item.nome === brinde.nome);
    if (idx >= 0) {
      next[idx].quantidade = Math.max(0, (next[idx].quantidade ?? 0) - brinde.quantidade);
    }
  }
  return next;
}

export function restaurarEstoqueBrindes(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntreguePonto[]
): EstoqueBrindePonto[] {
  const next = estoque.map((item) => ({ ...item }));
  for (const brinde of brindes) {
    const idx = brinde.item_id
      ? next.findIndex((item) => item.item_id === brinde.item_id)
      : next.findIndex((item) => item.nome === brinde.nome);
    if (idx >= 0) {
      next[idx].quantidade = (next[idx].quantidade ?? 0) + brinde.quantidade;
    } else {
      next.push({
        item_id: brinde.item_id ?? randomUUID(),
        nome: brinde.nome,
        quantidade: brinde.quantidade,
        custo_unitario: brinde.custo_unitario,
      });
    }
  }
  return next;
}

function findEstoqueItem(
  estoque: EstoqueBrindePonto[],
  item: { item_id?: string; nome: string }
): EstoqueBrindePonto | undefined {
  if (item.item_id) return estoque.find((e) => e.item_id === item.item_id);
  return estoque.find((e) => e.nome === item.nome);
}

/** Quantidade ainda disponível no ponto, considerando linhas já selecionadas na coleta. */
export function quantidadeRestanteBrindeNoPonto(
  estoque: EstoqueBrindePonto[],
  selecionados: BrindeEntreguePonto[],
  item: { item_id?: string; nome: string },
  excludeIndex?: number
): number {
  const estoqueItem = findEstoqueItem(estoque, item);
  if (!estoqueItem) return 0;

  const disponivel = Math.max(0, Math.floor(Number(estoqueItem.quantidade) || 0));
  const key = brindeKey(item);
  const usado = selecionados.reduce((sum, brinde, idx) => {
    if (excludeIndex !== undefined && idx === excludeIndex) return sum;
    if (brindeKey(brinde) === key) return sum + brinde.quantidade;
    return sum;
  }, 0);

  return Math.max(0, disponivel - usado);
}

export function maxQuantidadeLinhaBrinde(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntreguePonto[],
  lineIndex: number
): number {
  const linha = brindes[lineIndex];
  if (!linha) return 0;
  return quantidadeRestanteBrindeNoPonto(estoque, brindes, linha, lineIndex);
}

export function validarBrindesContraEstoquePonto(
  brindes: BrindeEntreguePonto[],
  estoque: EstoqueBrindePonto[]
): string | null {
  const totals = new Map<string, { nome: string; qty: number }>();

  for (const brinde of brindes) {
    if (brinde.quantidade <= 0) continue;
    const key = brindeKey(brinde);
    const atual = totals.get(key) ?? { nome: brinde.nome, qty: 0 };
    atual.qty += brinde.quantidade;
    totals.set(key, atual);
  }

  for (const [key, { nome, qty }] of totals) {
    const estoqueItem = estoque.find((item) => (item.item_id ?? item.nome) === key);
    if (!estoqueItem) {
      return `"${nome}" não está cadastrado no estoque deste ponto.`;
    }

    const disponivel = Math.max(0, Math.floor(Number(estoqueItem.quantidade) || 0));
    if (qty > disponivel) {
      return `"${nome}": no máximo ${disponivel} un. disponível(is) no ponto.`;
    }
  }

  return null;
}
