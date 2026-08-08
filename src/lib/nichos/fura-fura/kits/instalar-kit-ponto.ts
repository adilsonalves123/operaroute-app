import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeBrindeNoPonto, devolverEstoqueBrindesPontoParaCentral } from "@/lib/estoque/transferir-ponto";
import type { EstoqueItem, Ponto } from "@/lib/types/database";
import type { FuraKitReposicaoItem } from "./types";

type BrindePonto = NonNullable<Ponto["estoque_brindes"]>[number];

export async function carregarKitCompleto(
  supabase: SupabaseClient,
  kitId: string,
  empresaId: string
) {
  const { data: kit, error } = await supabase
    .from("fura_kits")
    .select("id, nome, ativo")
    .eq("id", kitId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !kit) return { error: "Kit não encontrado." as const };

  const [{ data: reposicao }, { data: premios }] = await Promise.all([
    supabase.from("fura_kit_reposicao_itens").select("*").eq("kit_id", kitId),
    supabase.from("fura_kit_premios").select("*").eq("kit_id", kitId).order("ordem"),
  ]);

  return {
    kit,
    reposicao: (reposicao ?? []) as FuraKitReposicaoItem[],
    premios: premios ?? [],
  };
}

async function obterQuantidadeKitMontado(
  supabase: SupabaseClient,
  empresaId: string,
  kitId: string
): Promise<number> {
  const { data } = await supabase
    .from("fura_kits_estoque")
    .select("quantidade")
    .eq("empresa_id", empresaId)
    .eq("kit_id", kitId)
    .maybeSingle();

  return Math.max(0, Math.floor(Number(data?.quantidade) || 0));
}

/** Instala 1 kit pronto no ponto: sobras voltam ao central, kit sai do depósito, pool novo no bar. */
export async function instalarKitNoPonto(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    pontoId: string;
    kitId: string;
    operadorId?: string | null;
    observacao?: string;
  }
): Promise<{
  error?: string;
  kitNome?: string;
  sobrasDevolvidas?: number;
  estoqueBrindes?: BrindePonto[];
}> {
  const loaded = await carregarKitCompleto(supabase, params.kitId, params.empresaId);
  if ("error" in loaded && loaded.error) return { error: loaded.error };

  const { kit, reposicao } = loaded;
  if (!reposicao.length) {
    return { error: "Kit sem itens cadastrados. Configure a composição do kit." };
  }

  const montados = await obterQuantidadeKitMontado(supabase, params.empresaId, params.kitId);
  if (montados < 1) {
    return {
      error: `Nenhum "${kit.nome}" pronto no depósito. Crie/salve o kit em Estoque → Kits antes de alocar.`,
    };
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, estoque_brindes")
    .eq("id", params.pontoId)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();

  if (pontoError || !ponto) return { error: "Ponto não encontrado." };

  const poolAnterior: BrindePonto[] = Array.isArray(ponto.estoque_brindes)
    ? (ponto.estoque_brindes as BrindePonto[]).map((b) => ({ ...b }))
    : [];

  const devolucao = await devolverEstoqueBrindesPontoParaCentral(supabase, {
    empresaId: params.empresaId,
    pontoId: params.pontoId,
    brindes: poolAnterior,
    observacao: `Sobra do ponto — troca kit ${kit.nome}`,
    tipoMovimento: "kit_sobra_retorno",
  });
  if (devolucao.error) return { error: devolucao.error };

  const estoqueIds = reposicao
    .map((r) => r.estoque_item_id)
    .filter((id): id is string => Boolean(id));

  const estoqueMap = new Map<string, EstoqueItem>();
  if (estoqueIds.length > 0) {
    const { data: itens } = await supabase
      .from("estoque")
      .select("id, nome_item, custo_unitario")
      .eq("empresa_id", params.empresaId)
      .in("id", estoqueIds);

    for (const item of itens ?? []) {
      estoqueMap.set(item.id, item as EstoqueItem);
    }
  }

  let brindesAtuais: BrindePonto[] = [];

  for (const linha of reposicao) {
    const qty = Math.max(1, Math.floor(linha.quantidade));
    if (linha.estoque_item_id) {
      const item = estoqueMap.get(linha.estoque_item_id);
      if (item) {
        brindesAtuais = mergeBrindeNoPonto(brindesAtuais, item, qty);
      } else {
        const idx = brindesAtuais.findIndex((b) => b.nome === linha.nome);
        const custo = Number(linha.custo_unitario ?? 0);
        if (idx >= 0) {
          brindesAtuais[idx].quantidade = (brindesAtuais[idx].quantidade ?? 0) + qty;
        } else {
          brindesAtuais.push({
            item_id: linha.estoque_item_id,
            nome: linha.nome,
            quantidade: qty,
            custo_unitario: custo,
          });
        }
      }
    } else {
      const idx = brindesAtuais.findIndex((b) => b.nome === linha.nome);
      const custo = Number(linha.custo_unitario ?? 0);
      if (idx >= 0) {
        brindesAtuais[idx].quantidade = (brindesAtuais[idx].quantidade ?? 0) + qty;
      } else {
        brindesAtuais.push({ nome: linha.nome, quantidade: qty, custo_unitario: custo });
      }
    }
  }

  const { data: estoqueKitRow } = await supabase
    .from("fura_kits_estoque")
    .select("id, quantidade")
    .eq("empresa_id", params.empresaId)
    .eq("kit_id", params.kitId)
    .maybeSingle();

  if (!estoqueKitRow) return { error: "Estoque de kits montados não encontrado." };

  const { error: baixaKitErr } = await supabase
    .from("fura_kits_estoque")
    .update({
      quantidade: montados - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estoqueKitRow.id);

  if (baixaKitErr) return { error: baixaKitErr.message };

  const agora = new Date().toISOString();

  const { error: updatePontoError } = await supabase
    .from("pontos")
    .update({
      estoque_brindes: brindesAtuais,
      kit_ativo_id: params.kitId,
      kit_instalado_em: agora,
    })
    .eq("id", params.pontoId)
    .eq("empresa_id", params.empresaId);

  if (updatePontoError) {
    await supabase
      .from("fura_kits_estoque")
      .update({ quantidade: montados })
      .eq("id", estoqueKitRow.id);
    return { error: updatePontoError.message };
  }

  await supabase.from("fura_kit_instalacoes").insert({
    empresa_id: params.empresaId,
    ponto_id: params.pontoId,
    kit_id: params.kitId,
    operador_id: params.operadorId ?? null,
    observacao:
      params.observacao ??
      (devolucao.totalUnidades > 0
        ? `Troca no bar — ${devolucao.totalUnidades} un. devolvida(s) ao central`
        : "Kit alocado no ponto"),
  });

  return {
    kitNome: kit.nome,
    sobrasDevolvidas: devolucao.totalUnidades,
    estoqueBrindes: brindesAtuais,
  };
}
