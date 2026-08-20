import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import { parseBrindesSalvos } from "@/lib/nichos/fura-fura/reconstruct-coleta";

type EstoqueBrinde = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

function restaurarEstoqueBrindes(
  estoque: EstoqueBrinde[],
  brindes: ReturnType<typeof parseBrindesSalvos>
): EstoqueBrinde[] {
  const next = estoque.map((e) => ({ ...e }));
  for (const b of brindes) {
    const idx = b.item_id
      ? next.findIndex((e) => e.item_id === b.item_id)
      : next.findIndex((e) => e.nome === b.nome);
    if (idx >= 0) {
      next[idx].quantidade = (next[idx].quantidade ?? 0) + b.quantidade;
    } else {
      next.push({
        item_id: b.item_id ?? randomUUID(),
        nome: b.nome,
        quantidade: b.quantidade,
        custo_unitario: b.custo_unitario,
      });
    }
  }
  return next;
}

/** GET no browser não pode cair em 405 — manda para o detalhe da coleta. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/coletas/fura-fura/${id}`, url.origin));
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
    .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
    .maybeSingle();

  if (coletaError || !coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, furos_estoque, estoque_brindes")
    .eq("id", coleta.ponto_id)
    .maybeSingle();

  await supabase.from("coleta_pagamentos").delete().eq("coleta_id", id);
  await supabase.from("financeiro").delete().eq("coleta_id", id);

  // Restaura haver/pendências que esta coleta abateu ANTES de apagar as dela.
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

  // Guarda vínculo com visita ao ponto antes de desvincular/apagar o item.
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

  if (ponto) {
    const pontoUpdates: Record<string, unknown> = {};
    const furos = Number(coleta.quantidade_furos ?? 0);
    if (furos > 0 && ponto.furos_estoque != null) {
      pontoUpdates.furos_estoque = Number(ponto.furos_estoque) + furos;
    }
    const brindes = parseBrindesSalvos(coleta.brindes_entregues);
    if (brindes.length > 0 && Array.isArray(ponto.estoque_brindes)) {
      pontoUpdates.estoque_brindes = restaurarEstoqueBrindes(
        ponto.estoque_brindes as EstoqueBrinde[],
        brindes
      );
    }
    if (Object.keys(pontoUpdates).length > 0) {
      await supabase.from("pontos").update(pontoUpdates).eq("id", ponto.id);
    }
  }

  const { registrarAuditoria } = await import("@/lib/auditoria/registrar");
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: profile.email,
    acao: "coleta.excluir",
    tabela: "coletas",
    registroId: id,
    dadosAnteriores: coleta as unknown as Record<string, unknown>,
    severidade: "high",
    categoria: "coleta",
    modulo: "coletas",
    titulo: preservarSlot ? "Substituiu coleta fura-fura (edição)" : "Apagou coleta fura-fura",
    resumo: `Ponto ${coleta.ponto_id} · valor líquido ${coleta.valor_liquido ?? "—"}`,
  });

  return NextResponse.json({
    success: true,
    visita_ponto_ids: visitaPontoIds,
  });
}
