import type { BrindeEntregue } from "../calculo-coleta";
import type { EstoqueBrindePonto } from "../validar-brindes-estoque";
import { validarBrindesContraEstoquePonto } from "../validar-brindes-estoque";
import { premiosEfetivosDoKit } from "./premios-from-reposicao";
import type { FuraKitPremio, FuraKitReposicaoItem } from "./types";

/** Estoque do ponto restrito aos itens do kit ativo. */
export function estoqueAvulsosDoKit(
  premios: FuraKitPremio[],
  estoquePonto: EstoqueBrindePonto[],
  reposicao: FuraKitReposicaoItem[] = []
): EstoqueBrindePonto[] {
  const allowed = premiosEfetivosDoKit(premios, reposicao);
  const out: EstoqueBrindePonto[] = [];
  for (const p of allowed) {
    const nomeNorm = p.nome.trim().toLowerCase();
    const item =
      (p.estoque_item_id
        ? estoquePonto.find((e) => e.item_id === p.estoque_item_id)
        : undefined) ??
      estoquePonto.find((e) => e.nome.trim().toLowerCase() === nomeNorm);
    if (!item) {
      // Item do kit sem saldo no ponto — ainda lista zerado p/ o operador ver a composição
      out.push({
        item_id: p.estoque_item_id ?? undefined,
        nome: p.nome,
        quantidade: 0,
        custo_unitario: Number(p.custo_unitario ?? 0),
      });
      continue;
    }
    out.push({
      item_id: item.item_id ?? p.estoque_item_id ?? undefined,
      nome: p.nome || item.nome,
      quantidade: item.quantidade,
      custo_unitario: Number(p.custo_unitario ?? item.custo_unitario ?? 0),
    });
  }
  return out;
}

function premioPermiteBrinde(p: FuraKitPremio, b: BrindeEntregue): boolean {
  if (p.estoque_item_id && b.item_id) return p.estoque_item_id === b.item_id;
  return p.nome.trim().toLowerCase() === b.nome.trim().toLowerCase();
}

/** Valida prêmios do kit + estoque do ponto. */
export function validarBrindesContraPremiosKit(
  brindes: BrindeEntregue[],
  premios: FuraKitPremio[],
  estoque: EstoqueBrindePonto[],
  reposicao: FuraKitReposicaoItem[] = []
): string | null {
  if (brindes.length === 0) return null;
  const allowed = premiosEfetivosDoKit(premios, reposicao);
  if (!allowed.length) {
    return "Kit ativo sem itens cadastrados. Configure o kit em Estoque → Kits.";
  }
  for (const b of brindes) {
    if (!allowed.some((p) => premioPermiteBrinde(p, b))) {
      return `"${b.nome}" não é prêmio do kit ativo neste ponto.`;
    }
  }
  return validarBrindesContraEstoquePonto(brindes, estoque);
}
