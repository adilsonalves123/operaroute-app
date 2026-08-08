import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import {
  normalizarEstoqueBrindesPonto,
  restaurarEstoqueBrindes,
  type BrindeEntreguePonto,
} from "@/lib/estoque/brindes-ponto";

function parseBrindesSalvos(raw: unknown): BrindeEntreguePonto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      item_id: typeof item?.item_id === "string" ? item.item_id : undefined,
      nome: String(item?.nome ?? "").trim(),
      quantidade: Math.max(0, Math.floor(Number(item?.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(item?.custo_unitario) || 0),
    }))
    .filter((item) => item.nome && item.quantidade > 0);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: coleta, error: coletaError } = await supabase
    .from("coletas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
    .maybeSingle();

  if (coletaError || !coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id")
    .eq("id", coleta.ponto_id)
    .maybeSingle();

  await supabase.from("coleta_pagamentos").delete().eq("coleta_id", id);
  await supabase.from("financeiro").delete().eq("coleta_id", id);

  const { reverterPendenciasAfetadasPorColeta } = await import(
    "@/lib/coletas/reverter-pendencias-coleta"
  );
  await reverterPendenciasAfetadasPorColeta(supabase, {
    empresaId: profile.empresa_id,
    pontoId: coleta.ponto_id,
    coletaId: id,
    createdAt: coleta.created_at,
  });

  await supabase
    .from("pendencias")
    .delete()
    .eq("coleta_id", id)
    .eq("empresa_id", profile.empresa_id);

  const { error: deleteError } = await supabase.from("coletas").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (ponto) {
    const brindes = parseBrindesSalvos(coleta.brindes_entregues);
    if (brindes.length > 0 && coleta.equipamento_id) {
      const { data: equipamento } = await supabase
        .from("equipamentos")
        .select("id, estoque_brindes")
        .eq("id", coleta.equipamento_id)
        .maybeSingle();

      if (equipamento) {
        const estoque = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
        await supabase
          .from("equipamentos")
          .update({ estoque_brindes: restaurarEstoqueBrindes(estoque, brindes) })
          .eq("id", equipamento.id);
      }
    }
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "coleta.excluir",
    tabela: "coletas",
    registroId: id,
    dadosAnteriores: coleta as unknown as Record<string, unknown>,
    severidade: "high",
    categoria: "coleta",
    modulo: "coletas",
    titulo: "Apagou coleta bolinha",
    resumo: `Equipamento ${coleta.equipamento_id ?? "—"} · lucro ${coleta.lucro_real ?? coleta.lucro_centavos ?? "—"}`,
  });

  return NextResponse.json({ success: true });
}
