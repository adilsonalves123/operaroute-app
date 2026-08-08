import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";

export type KitReposicaoLinha = {
  nome: string;
  quantidade: number;
  estoque_item_id?: string | null;
};

export type ItemRestanteKit = {
  nome: string;
  original: number;
  atual: number;
  pct: number;
};

export type ResumoKitNoPonto = {
  totalOriginal: number;
  totalAtual: number;
  /** 0–100 */
  pctRestante: number;
  itens: ItemRestanteKit[];
  /** Heurística: kit bem gasto — candidato a troca */
  potencialTroca: boolean;
};

/**
 * Compara o que restou no ponto com a composição do kit ativo.
 * Não há contagem de "N kits no ponto" — 1 kit ativo, estoque em unidades.
 */
export function resumirKitNoPonto(
  estoqueBrindes: unknown,
  reposicao: KitReposicaoLinha[],
  limiarTrocaPct = 40
): ResumoKitNoPonto {
  const atual = normalizarEstoqueBrindesPonto(estoqueBrindes);
  const itens: ItemRestanteKit[] = [];

  let totalOriginal = 0;
  let totalAtual = 0;

  for (const linha of reposicao) {
    const original = Math.max(0, Math.floor(Number(linha.quantidade) || 0));
    if (original <= 0) continue;

    const match = atual.find((b) => {
      if (linha.estoque_item_id && b.item_id) {
        return b.item_id === linha.estoque_item_id;
      }
      return b.nome.trim().toLowerCase() === linha.nome.trim().toLowerCase();
    });
    const qtyAtual = Math.max(0, Math.floor(Number(match?.quantidade) || 0));

    totalOriginal += original;
    totalAtual += Math.min(qtyAtual, original); // não conta “acima do kit” no %

    itens.push({
      nome: linha.nome,
      original,
      atual: qtyAtual,
      pct: original > 0 ? Math.round((Math.min(qtyAtual, original) / original) * 100) : 0,
    });
  }

  // Itens no ponto que não estão na composição (sobraram de kit antigo)
  for (const b of atual) {
    const jaListado = itens.some(
      (i) => i.nome.trim().toLowerCase() === b.nome.trim().toLowerCase()
    );
    if (!jaListado && b.quantidade > 0) {
      itens.push({
        nome: b.nome,
        original: 0,
        atual: b.quantidade,
        pct: 100,
      });
    }
  }

  const pctRestante =
    totalOriginal > 0 ? Math.round((totalAtual / totalOriginal) * 100) : 0;

  return {
    totalOriginal,
    totalAtual,
    pctRestante,
    itens,
    potencialTroca: totalOriginal > 0 && pctRestante <= limiarTrocaPct,
  };
}
