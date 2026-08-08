import type { SupabaseClient } from "@supabase/supabase-js";
import { isCategoriaPecas } from "@/lib/estoque/categorias";

export type PecaConsumoInput = {
  estoque_item_id: string;
  quantidade: number;
};

export type PecaConsumida = {
  estoque_item_id: string;
  nome_item: string;
  quantidade: number;
  custo_unitario: number;
};

/**
 * Valida e dá baixa no estoque de peças de reparo ao concluir um chamado.
 * Só aceita itens da categoria Peças (não mistura com brindes/bolinha/faca).
 */
export async function consumirPecasNoChamado(
  supabase: SupabaseClient,
  empresaId: string,
  chamadoId: string,
  pecas: PecaConsumoInput[]
): Promise<{ ok: true; consumidas: PecaConsumida[] } | { ok: false; error: string }> {
  const limpas = pecas
    .map((p) => ({
      estoque_item_id: String(p.estoque_item_id ?? "").trim(),
      quantidade: Math.max(0, Math.floor(Number(p.quantidade) || 0)),
    }))
    .filter((p) => p.estoque_item_id && p.quantidade > 0);

  if (limpas.length === 0) {
    return { ok: true, consumidas: [] };
  }

  const qtyPorItem = new Map<string, number>();
  for (const p of limpas) {
    qtyPorItem.set(p.estoque_item_id, (qtyPorItem.get(p.estoque_item_id) ?? 0) + p.quantidade);
  }

  const ids = [...qtyPorItem.keys()];
  const { data: itens, error: fetchErr } = await supabase
    .from("estoque")
    .select("id, nome_item, categoria, quantidade, custo_unitario")
    .eq("empresa_id", empresaId)
    .in("id", ids);

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const porId = new Map((itens ?? []).map((i) => [i.id, i]));
  const consumidas: PecaConsumida[] = [];

  for (const [itemId, qty] of qtyPorItem) {
    const item = porId.get(itemId);
    if (!item) {
      return { ok: false, error: "Peça não encontrada no estoque." };
    }
    if (!isCategoriaPecas(item.categoria)) {
      return {
        ok: false,
        error: `"${item.nome_item}" não é peça de reparo. Cadastre em Estoque → Peças.`,
      };
    }
    const disponivel = Math.max(0, Math.floor(Number(item.quantidade) || 0));
    if (qty > disponivel) {
      return {
        ok: false,
        error: `Estoque insuficiente de "${item.nome_item}" (tem ${disponivel}, pediu ${qty}).`,
      };
    }
    consumidas.push({
      estoque_item_id: item.id,
      nome_item: item.nome_item,
      quantidade: qty,
      custo_unitario: Math.max(0, Number(item.custo_unitario) || 0),
    });
  }

  for (const c of consumidas) {
    const item = porId.get(c.estoque_item_id)!;
    const novoSaldo = Math.max(0, Math.floor(Number(item.quantidade) || 0) - c.quantidade);

    const { error: updErr } = await supabase
      .from("estoque")
      .update({ quantidade: novoSaldo })
      .eq("id", c.estoque_item_id)
      .eq("empresa_id", empresaId);

    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    const { error: movErr } = await supabase.from("estoque_movimentacoes").insert({
      empresa_id: empresaId,
      item_id: c.estoque_item_id,
      tipo: "consumo_reparo",
      quantidade: c.quantidade,
      chamado_id: chamadoId,
      observacao: `Baixa no reparo (chamado ${chamadoId.slice(0, 8)})`,
    });

    if (movErr) {
      if (/chamado_id|schema cache/i.test(movErr.message)) {
        const { error: movErr2 } = await supabase.from("estoque_movimentacoes").insert({
          empresa_id: empresaId,
          item_id: c.estoque_item_id,
          tipo: "consumo_reparo",
          quantidade: c.quantidade,
          observacao: `Baixa no reparo (chamado ${chamadoId.slice(0, 8)})`,
        });
        if (movErr2) {
          return {
            ok: false,
            error:
              movErr2.message +
              " — rode supabase/chamado-pecas.sql no Supabase se ainda não rodou.",
          };
        }
      } else {
        return {
          ok: false,
          error:
            movErr.message +
            " — rode supabase/chamado-pecas.sql no Supabase se ainda não rodou.",
        };
      }
    }

    const { error: pecaErr } = await supabase.from("chamado_pecas").insert({
      empresa_id: empresaId,
      chamado_id: chamadoId,
      estoque_item_id: c.estoque_item_id,
      nome_item: c.nome_item,
      quantidade: c.quantidade,
      custo_unitario: c.custo_unitario,
    });

    if (pecaErr) {
      return {
        ok: false,
        error:
          pecaErr.message +
          " — rode supabase/chamado-pecas.sql no Supabase SQL Editor.",
      };
    }
  }

  return { ok: true, consumidas };
}

export function textoPecasConsumidas(consumidas: PecaConsumida[]): string {
  if (consumidas.length === 0) return "";
  const linhas = consumidas.map((c) => `• ${c.quantidade}× ${c.nome_item}`);
  return `\n\nPeças usadas:\n${linhas.join("\n")}`;
}
