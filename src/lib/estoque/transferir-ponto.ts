import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstoqueItem, Ponto } from "@/lib/types/database";

type BrindePonto = NonNullable<Ponto["estoque_brindes"]>[number];

export function mergeBrindeNoPonto(
  estoqueAtual: BrindePonto[],
  item: Pick<EstoqueItem, "id" | "nome_item" | "custo_unitario">,
  quantidade: number
): BrindePonto[] {
  const next = estoqueAtual.map((b) => ({ ...b }));
  const idx = next.findIndex((b) => b.item_id === item.id);
  if (idx >= 0) {
    next[idx].quantidade = (next[idx].quantidade ?? 0) + quantidade;
    next[idx].custo_unitario = Number(item.custo_unitario ?? next[idx].custo_unitario ?? 0);
  } else {
    next.push({
      item_id: item.id,
      nome: item.nome_item,
      quantidade,
      custo_unitario: Number(item.custo_unitario ?? 0),
    });
  }
  return next;
}

export async function transferirEstoqueParaPonto(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    itemId: string;
    pontoId: string;
    quantidade: number;
    observacao?: string;
  }
): Promise<{ error?: string }> {
  const { empresaId, itemId, pontoId, quantidade } = params;
  if (quantidade <= 0) return { error: "Quantidade inválida." };

  const [{ data: item, error: itemError }, { data: ponto, error: pontoError }] =
    await Promise.all([
      supabase
        .from("estoque")
        .select("*")
        .eq("id", itemId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("pontos")
        .select("id, estoque_brindes")
        .eq("id", pontoId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

  if (itemError || pontoError) {
    return { error: itemError?.message ?? pontoError?.message ?? "Erro ao buscar dados." };
  }
  if (!item) return { error: "Item de estoque não encontrado." };
  if (!ponto) return { error: "Ponto não encontrado." };

  const disponivel = Number(item.quantidade ?? 0);
  if (disponivel < quantidade) {
    return { error: `Estoque insuficiente. Disponível: ${disponivel}.` };
  }

  const brindesAtuais = Array.isArray(ponto.estoque_brindes)
    ? (ponto.estoque_brindes as BrindePonto[])
    : [];

  const { error: updateEstoqueError } = await supabase
    .from("estoque")
    .update({ quantidade: disponivel - quantidade })
    .eq("id", itemId)
    .eq("empresa_id", empresaId);

  if (updateEstoqueError) return { error: updateEstoqueError.message };

  const { error: updatePontoError } = await supabase
    .from("pontos")
    .update({
      estoque_brindes: mergeBrindeNoPonto(brindesAtuais, item, quantidade),
    })
    .eq("id", pontoId)
    .eq("empresa_id", empresaId);

  if (updatePontoError) {
    await supabase
      .from("estoque")
      .update({ quantidade: disponivel })
      .eq("id", itemId)
      .eq("empresa_id", empresaId);
    return { error: updatePontoError.message };
  }

  await supabase.from("estoque_movimentacoes").insert({
    empresa_id: empresaId,
    item_id: itemId,
    tipo: "transferencia_ponto",
    quantidade,
    ponto_id: pontoId,
    observacao: params.observacao ?? `Alocado para ponto`,
  });

  return {};
}
