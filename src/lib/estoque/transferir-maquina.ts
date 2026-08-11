import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ponto } from "@/lib/types/database";
import { isEquipamentoTipoComBrindes } from "@/lib/equipamentos";
import {
  deduzirEstoquePonto,
  normalizarEstoqueBrindesPonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";
import { mergeBrindeNoPonto } from "@/lib/estoque/transferir-ponto";

type BrindeLinha = NonNullable<Ponto["estoque_brindes"]>[number];

function brindeKey(item: { item_id?: string; nome: string }): string {
  return item.item_id ?? item.nome;
}

export async function alocarBrindePontoParaMaquina(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    equipamentoId: string;
    itemId: string;
    quantidade: number;
  }
): Promise<{ error?: string }> {
  const { empresaId, equipamentoId, itemId, quantidade } = params;
  if (quantidade <= 0) return { error: "Quantidade inválida." };

  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, ponto_id, tipo, estoque_brindes")
    .eq("id", equipamentoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (eqError) return { error: eqError.message };
  if (!equipamento) return { error: "Equipamento não encontrado." };
  if (!isEquipamentoTipoComBrindes(equipamento.tipo)) {
    return { error: "Este equipamento não suporta estoque de brindes." };
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, estoque_brindes")
    .eq("id", equipamento.ponto_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (pontoError) return { error: pontoError.message };
  if (!ponto) return { error: "Ponto não encontrado." };

  const estoquePonto = normalizarEstoqueBrindesPonto(ponto.estoque_brindes);
  const brindePonto = estoquePonto.find((item) => item.item_id === itemId);
  if (!brindePonto) {
    return { error: "Item não está no estoque do ponto. Aloque primeiro no ponto." };
  }

  const disponivel = Math.max(0, Math.floor(Number(brindePonto.quantidade) || 0));
  if (disponivel < quantidade) {
    return { error: `Disponível no ponto: ${disponivel} un.` };
  }

  const estoqueMaquina = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
  const novoPonto = deduzirEstoquePonto(estoquePonto, [
    {
      item_id: brindePonto.item_id,
      nome: brindePonto.nome,
      quantidade,
      custo_unitario: brindePonto.custo_unitario ?? 0,
    },
  ]);
  const novoMaquina = mergeBrindeNoPonto(
    estoqueMaquina as BrindeLinha[],
    {
      id: itemId,
      nome_item: brindePonto.nome,
      custo_unitario: brindePonto.custo_unitario ?? 0,
    },
    quantidade
  );

  const { error: updatePontoError } = await supabase
    .from("pontos")
    .update({ estoque_brindes: novoPonto })
    .eq("id", ponto.id)
    .eq("empresa_id", empresaId);

  if (updatePontoError) return { error: updatePontoError.message };

  const { error: updateMaquinaError } = await supabase
    .from("equipamentos")
    .update({ estoque_brindes: novoMaquina })
    .eq("id", equipamentoId)
    .eq("empresa_id", empresaId);

  if (updateMaquinaError) {
    await supabase
      .from("pontos")
      .update({ estoque_brindes: estoquePonto })
      .eq("id", ponto.id)
      .eq("empresa_id", empresaId);
    return { error: updateMaquinaError.message };
  }

  return {};
}

/** Central → máquina direto (sem passar pelo pool do ponto). */
export async function alocarBrindeCentralParaMaquina(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    equipamentoId: string;
    itemId: string;
    quantidade: number;
  }
): Promise<{ error?: string }> {
  const { empresaId, equipamentoId, itemId, quantidade } = params;
  if (quantidade <= 0) return { error: "Quantidade inválida." };

  const [{ data: item, error: itemError }, { data: equipamento, error: eqError }] =
    await Promise.all([
      supabase
        .from("estoque")
        .select("id, nome_item, custo_unitario, quantidade")
        .eq("id", itemId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("equipamentos")
        .select("id, ponto_id, tipo, estoque_brindes")
        .eq("id", equipamentoId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

  if (itemError || eqError) {
    return { error: itemError?.message ?? eqError?.message ?? "Erro ao buscar dados." };
  }
  if (!item) return { error: "Item de estoque não encontrado." };
  if (!equipamento) return { error: "Equipamento não encontrado." };
  if (!isEquipamentoTipoComBrindes(equipamento.tipo)) {
    return { error: "Este equipamento não suporta estoque de brindes." };
  }

  const disponivel = Math.max(0, Math.floor(Number(item.quantidade) || 0));
  if (disponivel < quantidade) {
    return { error: `Estoque central insuficiente. Disponível: ${disponivel} un.` };
  }

  const estoqueMaquina = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
  const novoMaquina = mergeBrindeNoPonto(
    estoqueMaquina as BrindeLinha[],
    {
      id: item.id,
      nome_item: item.nome_item,
      custo_unitario: Number(item.custo_unitario ?? 0),
    },
    quantidade
  );

  const { error: updateEstoqueError } = await supabase
    .from("estoque")
    .update({ quantidade: disponivel - quantidade })
    .eq("id", itemId)
    .eq("empresa_id", empresaId);

  if (updateEstoqueError) return { error: updateEstoqueError.message };

  const { error: updateMaquinaError } = await supabase
    .from("equipamentos")
    .update({ estoque_brindes: novoMaquina })
    .eq("id", equipamentoId)
    .eq("empresa_id", empresaId);

  if (updateMaquinaError) {
    await supabase
      .from("estoque")
      .update({ quantidade: disponivel })
      .eq("id", itemId)
      .eq("empresa_id", empresaId);
    return { error: updateMaquinaError.message };
  }

  await supabase.from("estoque_movimentacoes").insert({
    empresa_id: empresaId,
    item_id: itemId,
    tipo: "transferencia_maquina",
    quantidade,
    ponto_id: equipamento.ponto_id,
    observacao: "Alocado direto na máquina",
  });

  return {};
}

export async function devolverBrindeMaquinaParaPonto(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    equipamentoId: string;
    itemId: string;
    quantidade: number;
  }
): Promise<{ error?: string }> {
  const { empresaId, equipamentoId, itemId, quantidade } = params;
  if (quantidade <= 0) return { error: "Quantidade inválida." };

  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, ponto_id, tipo, estoque_brindes")
    .eq("id", equipamentoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (eqError) return { error: eqError.message };
  if (!equipamento) return { error: "Equipamento não encontrado." };
  if (!isEquipamentoTipoComBrindes(equipamento.tipo)) {
    return { error: "Este equipamento não suporta estoque de brindes." };
  }

  const estoqueMaquina = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
  const brindeMaquina = estoqueMaquina.find((item) => item.item_id === itemId);
  if (!brindeMaquina) {
    return { error: "Item não está alocado nesta máquina." };
  }

  const disponivel = Math.max(0, Math.floor(Number(brindeMaquina.quantidade) || 0));
  if (disponivel < quantidade) {
    return { error: `Alocado na máquina: ${disponivel} un.` };
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, estoque_brindes")
    .eq("id", equipamento.ponto_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (pontoError) return { error: pontoError.message };
  if (!ponto) return { error: "Ponto não encontrado." };

  const estoquePonto = normalizarEstoqueBrindesPonto(ponto.estoque_brindes);
  const novoMaquina = deduzirEstoquePonto(estoqueMaquina, [
    {
      item_id: brindeMaquina.item_id,
      nome: brindeMaquina.nome,
      quantidade,
      custo_unitario: brindeMaquina.custo_unitario ?? 0,
    },
  ]);
  const novoPonto = mergeBrindeNoPonto(
    estoquePonto as BrindeLinha[],
    {
      id: itemId,
      nome_item: brindeMaquina.nome,
      custo_unitario: brindeMaquina.custo_unitario ?? 0,
    },
    quantidade
  );

  const { error: updateMaquinaError } = await supabase
    .from("equipamentos")
    .update({ estoque_brindes: novoMaquina })
    .eq("id", equipamentoId)
    .eq("empresa_id", empresaId);

  if (updateMaquinaError) return { error: updateMaquinaError.message };

  const { error: updatePontoError } = await supabase
    .from("pontos")
    .update({ estoque_brindes: novoPonto })
    .eq("id", ponto.id)
    .eq("empresa_id", empresaId);

  if (updatePontoError) {
    await supabase
      .from("equipamentos")
      .update({ estoque_brindes: estoqueMaquina })
      .eq("id", equipamentoId)
      .eq("empresa_id", empresaId);
    return { error: updatePontoError.message };
  }

  return {};
}

/** Devolve todo o estoque de brindes da máquina para o pool do ponto. */
export async function devolverTodoEstoqueMaquinaParaPonto(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    equipamentoId: string;
    /** Se true, zera o estoque da máquina mesmo quando não dá para devolver ao ponto. */
    limparSeFalhar?: boolean;
  }
): Promise<{ totalUnidades: number; error?: string }> {
  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, ponto_id, tipo, estoque_brindes")
    .eq("id", params.equipamentoId)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();

  if (eqError) return { totalUnidades: 0, error: eqError.message };
  if (!equipamento) return { totalUnidades: 0, error: "Equipamento não encontrado." };

  const brindes = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
  if (brindes.length === 0) return { totalUnidades: 0 };

  // Tipos sem brindes (ou sem ponto): só limpa o JSON se pedido.
  if (!isEquipamentoTipoComBrindes(equipamento.tipo) || !equipamento.ponto_id) {
    if (params.limparSeFalhar) {
      const { error } = await supabase
        .from("equipamentos")
        .update({ estoque_brindes: [] })
        .eq("id", params.equipamentoId)
        .eq("empresa_id", params.empresaId);
      if (error) return { totalUnidades: 0, error: error.message };
      return { totalUnidades: 0 };
    }
    if (!isEquipamentoTipoComBrindes(equipamento.tipo)) {
      return { totalUnidades: 0 };
    }
    return { totalUnidades: 0, error: "Ponto não encontrado." };
  }

  let total = 0;

  for (const brinde of brindes) {
    if (!brinde.item_id) continue;
    const qty = Math.max(0, Math.floor(Number(brinde.quantidade) || 0));
    if (qty <= 0) continue;

    const result = await devolverBrindeMaquinaParaPonto(supabase, {
      empresaId: params.empresaId,
      equipamentoId: params.equipamentoId,
      itemId: brinde.item_id,
      quantidade: qty,
    });

    if (result.error) {
      if (params.limparSeFalhar) {
        const { error } = await supabase
          .from("equipamentos")
          .update({ estoque_brindes: [] })
          .eq("id", params.equipamentoId)
          .eq("empresa_id", params.empresaId);
        if (error) return { totalUnidades: total, error: error.message };
        return { totalUnidades: total };
      }
      return { totalUnidades: total, error: result.error };
    }
    total += qty;
  }

  return { totalUnidades: total };
}

export function somarEstoqueBrindes(brindes: EstoqueBrindePonto[]): number {
  return brindes.reduce((sum, item) => sum + Math.max(0, Number(item.quantidade) || 0), 0);
}

export function estoquePontoDisponivelParaMaquina(
  estoquePonto: EstoqueBrindePonto[],
  itemId: string
): number {
  const item = estoquePonto.find((b) => b.item_id === itemId);
  return item ? Math.max(0, Math.floor(Number(item.quantidade) || 0)) : 0;
}

export { brindeKey };
