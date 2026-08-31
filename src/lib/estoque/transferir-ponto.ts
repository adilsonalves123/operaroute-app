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

/** Devolve o saldo atual de brindes do ponto ao estoque central. */
export async function devolverEstoqueBrindesPontoParaCentral(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    pontoId: string;
    brindes: BrindePonto[];
    observacao: string;
    tipoMovimento?: string;
  }
): Promise<{ totalUnidades: number; error?: string }> {
  const tipo = params.tipoMovimento ?? "devolucao_ponto";
  let total = 0;

  for (const brinde of params.brindes) {
    const qty = Math.max(0, Math.floor(Number(brinde.quantidade) || 0));
    if (qty <= 0) continue;

    let estoqueId = brinde.item_id ?? undefined;

    if (!estoqueId) {
      const { data: rows } = await supabase
        .from("estoque")
        .select("id, nome_item")
        .eq("empresa_id", params.empresaId);

      const match = (rows ?? []).find(
        (row) => row.nome_item.trim().toLowerCase() === brinde.nome.trim().toLowerCase()
      );
      estoqueId = match?.id;
    }

    if (!estoqueId) continue;

    const { data: item } = await supabase
      .from("estoque")
      .select("id, quantidade")
      .eq("id", estoqueId)
      .eq("empresa_id", params.empresaId)
      .maybeSingle();

    if (!item) continue;

    const novaQtd = (Number(item.quantidade) || 0) + qty;
    const { error: updErr } = await supabase
      .from("estoque")
      .update({ quantidade: novaQtd })
      .eq("id", item.id)
      .eq("empresa_id", params.empresaId);

    if (updErr) return { totalUnidades: total, error: updErr.message };

    await supabase.from("estoque_movimentacoes").insert({
      empresa_id: params.empresaId,
      item_id: item.id,
      tipo,
      quantidade: qty,
      ponto_id: params.pontoId,
      observacao: params.observacao,
    });

    total += qty;
  }

  return { totalUnidades: total };
}

/** Remove brinde(s) do ponto e devolve ao estoque central. */
export async function devolverBrindeDoPontoParaCentral(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    pontoId: string;
    itemId?: string;
    nome?: string;
    quantidade?: number;
    observacao?: string;
  }
): Promise<{ devolvido: number; error?: string }> {
  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, estoque_brindes")
    .eq("id", params.pontoId)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();

  if (pontoError || !ponto) {
    return { devolvido: 0, error: pontoError?.message ?? "Ponto não encontrado." };
  }

  const brindes: BrindePonto[] = Array.isArray(ponto.estoque_brindes)
    ? (ponto.estoque_brindes as BrindePonto[]).map((b) => ({ ...b }))
    : [];

  const idx = params.itemId
    ? brindes.findIndex((b) => b.item_id === params.itemId)
    : brindes.findIndex(
        (b) => b.nome.trim().toLowerCase() === String(params.nome ?? "").trim().toLowerCase()
      );

  if (idx < 0) {
    return { devolvido: 0, error: "Item não encontrado neste ponto." };
  }

  const linha = brindes[idx];
  const disponivel = Math.max(0, Math.floor(Number(linha.quantidade) || 0));
  if (disponivel <= 0) {
    return { devolvido: 0, error: "Este item já está zerado no ponto." };
  }

  const qty =
    params.quantidade != null
      ? Math.min(disponivel, Math.max(0, Math.floor(params.quantidade)))
      : disponivel;

  if (qty <= 0) {
    return { devolvido: 0, error: "Quantidade inválida." };
  }

  const devolucao = await devolverEstoqueBrindesPontoParaCentral(supabase, {
    empresaId: params.empresaId,
    pontoId: params.pontoId,
    brindes: [{ ...linha, quantidade: qty }],
    observacao: params.observacao ?? `Devolução de ${linha.nome} do ponto`,
  });

  if (devolucao.error) {
    return { devolvido: 0, error: devolucao.error };
  }

  const restante = disponivel - qty;
  if (restante <= 0) {
    brindes.splice(idx, 1);
  } else {
    brindes[idx] = { ...linha, quantidade: restante };
  }

  const { error: updateError } = await supabase
    .from("pontos")
    .update({ estoque_brindes: brindes })
    .eq("id", params.pontoId)
    .eq("empresa_id", params.empresaId);

  if (updateError) {
    return { devolvido: 0, error: updateError.message };
  }

  return { devolvido: devolucao.totalUnidades };
}
