import type { SupabaseClient } from "@supabase/supabase-js";
import {
  desmontarKitsNoCentral,
  montarKitsNoCentral,
} from "@/lib/nichos/fura-fura/kits/montar-kit-estoque";

export async function quantidadeKitNoDeposito(
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

/** Devolve todos os kits prontos ao estoque central (usa a composição atual). */
export async function devolverTodoKitAoEstoque(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    kitId: string;
    operadorId?: string | null;
    observacao?: string;
  }
): Promise<{ error?: string; devolvidos?: number }> {
  const atual = await quantidadeKitNoDeposito(supabase, params.empresaId, params.kitId);
  if (atual < 1) return { devolvidos: 0 };

  const des = await desmontarKitsNoCentral(supabase, {
    empresaId: params.empresaId,
    kitId: params.kitId,
    quantidade: atual,
    operadorId: params.operadorId,
    observacao: params.observacao ?? "Itens do kit voltaram ao estoque central",
  });
  if (des.error) return { error: des.error };
  return { devolvidos: atual };
}

/** Consome itens do estoque e deixa N kits prontos no depósito. */
export async function montarKitsProntos(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    kitId: string;
    quantidade: number;
    operadorId?: string | null;
    observacao?: string;
  }
): Promise<{ error?: string; noDeposito?: number }> {
  const qty = Math.max(1, Math.floor(params.quantidade));
  const montar = await montarKitsNoCentral(supabase, {
    empresaId: params.empresaId,
    kitId: params.kitId,
    quantidade: qty,
    operadorId: params.operadorId,
    observacao: params.observacao ?? "Itens saíram do estoque para o kit",
  });
  if (montar.error) return { error: montar.error };
  return { noDeposito: montar.totalNoDeposito ?? qty };
}
