import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { NICHO_MODULO_CONSIGNADO } from "@/lib/nichos/consignado";
import {
  normalizarEstoqueBrindesPonto,
  restaurarEstoqueBrindes,
  type BrindeEntreguePonto,
} from "@/lib/estoque/brindes-ponto";

function parseVendidosSalvos(raw: unknown): BrindeEntreguePonto[] {
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

/** GET no browser não pode cair em 405 — manda para o detalhe da coleta. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/coletas/consignado/${id}`, url.origin));
}

/**
 * POST com { action: "preparar_edicao", preservar_slot: true } —
 * mesmo efeito do DELETE?preservar_slot=1 (evita proxy/CDN que bloqueia DELETE).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  const preservar =
    body?.preservar_slot === true ||
    body?.preservar_slot === 1 ||
    body?.preservar_slot === "1";
  if (action !== "preparar_edicao" && action !== "substituir") {
    return NextResponse.json(
      { error: "Ação inválida. Use action: preparar_edicao." },
      { status: 400 }
    );
  }
  const url = new URL(request.url);
  if (preservar) url.searchParams.set("preservar_slot", "1");
  return DELETE(new Request(url, { method: "DELETE" }), context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const url = new URL(request.url);
  const preservarSlot =
    url.searchParams.get("preservar_slot") === "1" ||
    url.searchParams.get("preservar_slot") === "true";

  const supabase = await createClient();

  const { data: coleta, error: coletaError } = await supabase
    .from("coletas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
    .maybeSingle();

  if (coletaError || !coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

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

  const { data: itensVisitaPonto } = await supabase
    .from("visita_ponto_itens")
    .select("id, visita_ponto_id")
    .eq("coleta_id", id)
    .eq("empresa_id", profile.empresa_id);
  const visitaPontoIds = [
    ...new Set(
      (itensVisitaPonto ?? [])
        .map((i) => i.visita_ponto_id)
        .filter((v): v is string => Boolean(v))
    ),
  ];

  if (visitaPontoIds.length > 0) {
    const { data: visitasPontoStatus } = await supabase
      .from("visitas_ponto")
      .select("id, status")
      .in("id", visitaPontoIds)
      .eq("empresa_id", profile.empresa_id);

    const statusPorId = new Map(
      (visitasPontoStatus ?? []).map((v) => [v.id, String(v.status ?? "").toLowerCase()])
    );

    for (const item of itensVisitaPonto ?? []) {
      if (!item.visita_ponto_id || !item.id) continue;
      const status = statusPorId.get(item.visita_ponto_id) ?? "rascunho";
      const softUnlink =
        preservarSlot && (status === "finalizada" || status === "cancelada");
      if (softUnlink) {
        await supabase
          .from("visita_ponto_itens")
          .update({ coleta_id: null })
          .eq("id", item.id)
          .eq("empresa_id", profile.empresa_id);
      } else {
        await supabase
          .from("visita_ponto_itens")
          .delete()
          .eq("id", item.id)
          .eq("empresa_id", profile.empresa_id);
      }
    }
  }

  const { error: deleteError } = await supabase.from("coletas").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Devolve unidades vendidas ao expositor (reposto pós-coleta não fica na coleta).
  const vendidos = parseVendidosSalvos(coleta.brindes_entregues);
  if (vendidos.length > 0 && coleta.equipamento_id) {
    const { data: equipamento } = await supabase
      .from("equipamentos")
      .select("id, estoque_brindes")
      .eq("id", coleta.equipamento_id)
      .maybeSingle();

    if (equipamento) {
      const estoque = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
      await supabase
        .from("equipamentos")
        .update({ estoque_brindes: restaurarEstoqueBrindes(estoque, vendidos) })
        .eq("id", equipamento.id);
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
    titulo: preservarSlot
      ? "Substituiu coleta consignado (edição)"
      : "Apagou coleta consignado",
    resumo: `Equipamento ${coleta.equipamento_id ?? "—"} · lucro ${coleta.lucro_real ?? "—"}`,
  });

  return NextResponse.json({
    success: true,
    visita_ponto_ids: visitaPontoIds,
  });
}
