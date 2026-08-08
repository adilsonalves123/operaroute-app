import type { BrindeEntregue } from "./calculo-coleta";

export type EstoqueBrindePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

function brindeKey(b: { item_id?: string; nome: string }): string {
  return b.item_id ?? b.nome;
}

function findEstoqueItem(
  estoque: EstoqueBrindePonto[],
  b: { item_id?: string; nome: string }
): EstoqueBrindePonto | undefined {
  if (b.item_id) return estoque.find((e) => e.item_id === b.item_id);
  return estoque.find((e) => e.nome === b.nome);
}

/** Retorna mensagem de erro ou null se válido. */
export function validarBrindesContraEstoquePonto(
  brindes: BrindeEntregue[],
  estoque: EstoqueBrindePonto[]
): string | null {
  const totals = new Map<string, { nome: string; qty: number }>();

  for (const b of brindes) {
    if (b.quantidade <= 0) continue;
    const key = brindeKey(b);
    const cur = totals.get(key) ?? { nome: b.nome, qty: 0 };
    cur.qty += b.quantidade;
    totals.set(key, cur);
  }

  for (const [key, { nome, qty }] of totals) {
    const estoqueItem = estoque.find((e) => (e.item_id ?? e.nome) === key);
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

/** Quantas unidades ainda podem ser adicionadas deste item (considerando linhas já selecionadas). */
export function quantidadeRestanteBrindeNoPonto(
  estoque: EstoqueBrindePonto[],
  brindesSelecionados: BrindeEntregue[],
  item: { item_id?: string; nome: string },
  excludeIndex?: number
): number {
  const estoqueItem = findEstoqueItem(estoque, item);
  if (!estoqueItem) return 0;

  const disponivel = Math.max(0, Math.floor(Number(estoqueItem.quantidade) || 0));
  const key = brindeKey(item);
  const usado = brindesSelecionados.reduce((s, b, idx) => {
    if (excludeIndex !== undefined && idx === excludeIndex) return s;
    if (brindeKey(b) === key) return s + b.quantidade;
    return s;
  }, 0);

  return Math.max(0, disponivel - usado);
}

/** Máximo permitido na linha `lineIndex` da lista de brindes. */
export function maxQuantidadeLinhaBrinde(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntregue[],
  lineIndex: number
): number {
  const linha = brindes[lineIndex];
  if (!linha) return 0;

  const estoqueItem = findEstoqueItem(estoque, linha);
  if (!estoqueItem) return 0;

  const disponivel = Math.max(0, Math.floor(Number(estoqueItem.quantidade) || 0));
  const key = brindeKey(linha);
  const outros = brindes.reduce(
    (s, b, j) => (j !== lineIndex && brindeKey(b) === key ? s + b.quantidade : s),
    0
  );

  return Math.max(0, disponivel - outros);
}
