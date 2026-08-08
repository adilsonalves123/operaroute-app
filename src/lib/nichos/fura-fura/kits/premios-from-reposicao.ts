import type { FuraKitPremio, FuraKitReposicaoItem } from "./types";

/** Tipos de prêmio permitidos na coleta — derivados dos itens do kit (sem duplicar o mesmo item). */
export function premiosFromReposicao(
  reposicao: FuraKitReposicaoItem[]
): Omit<FuraKitPremio, "id" | "kit_id">[] {
  const seen = new Set<string>();
  const out: Omit<FuraKitPremio, "id" | "kit_id">[] = [];
  let ordem = 0;

  for (const r of reposicao) {
    const key = (r.estoque_item_id ?? r.nome.trim().toLowerCase()) || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      estoque_item_id: r.estoque_item_id,
      nome: r.nome,
      custo_unitario: Number(r.custo_unitario ?? 0),
      ordem: ordem++,
    });
  }

  return out;
}

export function premiosEfetivosDoKit(
  premios: FuraKitPremio[],
  reposicao: FuraKitReposicaoItem[]
): FuraKitPremio[] {
  if (premios.length) return premios;
  return premiosFromReposicao(reposicao) as FuraKitPremio[];
}
