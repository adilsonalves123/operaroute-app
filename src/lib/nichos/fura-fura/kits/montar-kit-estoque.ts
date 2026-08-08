import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstoqueItem } from "@/lib/types/database";
import type { FuraKitReposicaoItem } from "./types";
import { carregarKitCompleto } from "./instalar-kit-ponto";

/** Quantos kits completos dá para montar com o estoque avulso atual. */
export function calcularKitsPossiveis(
  reposicao: FuraKitReposicaoItem[],
  estoqueItens: Pick<EstoqueItem, "id" | "quantidade">[]
): number {
  const map = new Map(estoqueItens.map((e) => [e.id, Number(e.quantidade) || 0]));
  let max = Infinity;

  for (const linha of reposicao) {
    if (!linha.estoque_item_id) continue;
    const need = Math.max(1, Math.floor(linha.quantidade));
    const disponivel = map.get(linha.estoque_item_id) ?? 0;
    max = Math.min(max, Math.floor(disponivel / need));
  }

  return max === Infinity ? 0 : Math.max(0, max);
}

async function carregarEstoqueMap(
  supabase: SupabaseClient,
  empresaId: string,
  reposicao: FuraKitReposicaoItem[]
) {
  const ids = reposicao.map((r) => r.estoque_item_id).filter((id): id is string => Boolean(id));
  const map = new Map<string, EstoqueItem>();
  if (!ids.length) return map;

  const { data: itens } = await supabase
    .from("estoque")
    .select("*")
    .eq("empresa_id", empresaId)
    .in("id", ids);

  for (const item of itens ?? []) {
    map.set(item.id, item as EstoqueItem);
  }
  return map;
}

async function obterQuantidadeNoDeposito(
  supabase: SupabaseClient,
  empresaId: string,
  kitId: string
): Promise<{ id: string | null; quantidade: number }> {
  const { data: row } = await supabase
    .from("fura_kits_estoque")
    .select("id, quantidade")
    .eq("empresa_id", empresaId)
    .eq("kit_id", kitId)
    .maybeSingle();

  return {
    id: row?.id ?? null,
    quantidade: Math.max(0, Math.floor(Number(row?.quantidade) || 0)),
  };
}

/** Monta kits no depósito: baixa itens avulsos e incrementa estoque de kits prontos. */
export async function montarKitsNoCentral(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    kitId: string;
    quantidade: number;
    operadorId?: string | null;
    observacao?: string;
  }
): Promise<{ error?: string; montados?: number; totalNoDeposito?: number }> {
  const qty = Math.floor(params.quantidade);
  if (qty <= 0) return { error: "Informe a quantidade de kits a montar." };

  const loaded = await carregarKitCompleto(supabase, params.kitId, params.empresaId);
  if ("error" in loaded && loaded.error) return { error: loaded.error };

  const { kit, reposicao } = loaded;
  if (!reposicao.length) {
    return { error: "Kit sem itens cadastrados." };
  }

  const estoqueMap = await carregarEstoqueMap(supabase, params.empresaId, reposicao);
  const possiveis = calcularKitsPossiveis(
    reposicao,
    [...estoqueMap.values()].map((e) => ({ id: e.id, quantidade: e.quantidade }))
  );

  if (possiveis < qty) {
    return {
      error: `Estoque avulso insuficiente. Dá para montar no máximo ${possiveis} kit(s).`,
    };
  }

  for (const linha of reposicao) {
    if (!linha.estoque_item_id) continue;
    const item = estoqueMap.get(linha.estoque_item_id);
    if (!item) return { error: `Item "${linha.nome}" não encontrado no estoque.` };
    const need = Math.max(1, Math.floor(linha.quantidade)) * qty;
    const disponivel = Number(item.quantidade ?? 0);
    if (disponivel < need) {
      return { error: `Estoque insuficiente para "${linha.nome}".` };
    }
  }

  for (const linha of reposicao) {
    if (!linha.estoque_item_id) continue;
    const item = estoqueMap.get(linha.estoque_item_id)!;
    const need = Math.max(1, Math.floor(linha.quantidade)) * qty;
    const disponivel = Number(item.quantidade ?? 0);

    const { error: updErr } = await supabase
      .from("estoque")
      .update({ quantidade: disponivel - need })
      .eq("id", item.id)
      .eq("empresa_id", params.empresaId);

    if (updErr) return { error: updErr.message };

    await supabase.from("estoque_movimentacoes").insert({
      empresa_id: params.empresaId,
      item_id: item.id,
      tipo: "kit_montagem",
      quantidade: need,
      observacao: `Montagem ${qty}× Kit ${kit.nome}`,
    });
  }

  const deposito = await obterQuantidadeNoDeposito(supabase, params.empresaId, params.kitId);
  const novaQtd = deposito.quantidade + qty;

  if (deposito.id) {
    const { error } = await supabase
      .from("fura_kits_estoque")
      .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
      .eq("id", deposito.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("fura_kits_estoque").insert({
      empresa_id: params.empresaId,
      kit_id: params.kitId,
      quantidade: novaQtd,
    });
    if (error) return { error: error.message };
  }

  await supabase.from("fura_kit_montagens").insert({
    empresa_id: params.empresaId,
    kit_id: params.kitId,
    quantidade: qty,
    operador_id: params.operadorId ?? null,
    observacao: params.observacao ?? null,
  });

  return { montados: qty, totalNoDeposito: novaQtd };
}

/** Desmonta kits no depósito: kits prontos voltam a ser itens avulsos no estoque central. */
export async function desmontarKitsNoCentral(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    kitId: string;
    quantidade: number;
    operadorId?: string | null;
    observacao?: string;
  }
): Promise<{ error?: string; desmontados?: number; totalNoDeposito?: number }> {
  const qty = Math.floor(params.quantidade);
  if (qty <= 0) return { error: "Informe quantos kits desmontar." };

  const loaded = await carregarKitCompleto(supabase, params.kitId, params.empresaId);
  if ("error" in loaded && loaded.error) return { error: loaded.error };

  const { kit, reposicao } = loaded;
  if (!reposicao.length) {
    return { error: "Kit sem itens cadastrados." };
  }

  const deposito = await obterQuantidadeNoDeposito(supabase, params.empresaId, params.kitId);
  if (deposito.quantidade < qty) {
    return {
      error: `Só há ${deposito.quantidade} kit(s) no depósito. Não dá para desmontar ${qty}.`,
    };
  }

  if (!deposito.id) {
    return { error: "Nenhum kit montado no depósito." };
  }

  const estoqueMap = await carregarEstoqueMap(supabase, params.empresaId, reposicao);

  for (const linha of reposicao) {
    if (!linha.estoque_item_id) continue;
    const item = estoqueMap.get(linha.estoque_item_id);
    if (!item) return { error: `Item "${linha.nome}" não encontrado no estoque.` };

    const devolver = Math.max(1, Math.floor(linha.quantidade)) * qty;
    const atual = Number(item.quantidade ?? 0);

    const { error: updErr } = await supabase
      .from("estoque")
      .update({ quantidade: atual + devolver })
      .eq("id", item.id)
      .eq("empresa_id", params.empresaId);

    if (updErr) return { error: updErr.message };

    await supabase.from("estoque_movimentacoes").insert({
      empresa_id: params.empresaId,
      item_id: item.id,
      tipo: "kit_desmontagem",
      quantidade: devolver,
      observacao: `Desmontagem ${qty}× Kit ${kit.nome} — voltou ao avulso`,
    });
  }

  const novaQtd = deposito.quantidade - qty;
  const { error: depErr } = await supabase
    .from("fura_kits_estoque")
    .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
    .eq("id", deposito.id);

  if (depErr) return { error: depErr.message };

  return { desmontados: qty, totalNoDeposito: novaQtd };
}

export async function obterKitsMontadosPorEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("fura_kits_estoque")
    .select("kit_id, quantidade")
    .eq("empresa_id", empresaId);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.kit_id, Number(row.quantidade) || 0);
  }
  return map;
}
