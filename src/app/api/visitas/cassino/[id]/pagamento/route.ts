import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { corrigirPagamentoVisitaCassino } from "@/lib/coletas/corrigir-pagamento-coleta";
import { parseMoneyInput } from "@/lib/utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const pix = parseMoneyInput(String(body.valor_pix ?? body.pix ?? "0"));
  const dinheiro = parseMoneyInput(String(body.valor_dinheiro ?? body.dinheiro ?? "0"));

  const supabase = await createClient();

  const { data: visita } = await supabase
    .from("visitas")
    .select("id, pontos(nome)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!visita) {
    return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  }

  const pontoNome =
    (visita.pontos as { nome?: string } | null)?.nome ?? null;

  const result = await corrigirPagamentoVisitaCassino(supabase, {
    empresaId: profile.empresa_id,
    visitaId: id,
    pix,
    dinheiro,
    operadorId: profile.user_id,
    pontoNome,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "visita.corrigir_pagamento",
      tabela: "visitas",
      registroId: id,
      dadosNovos: {
        valor_pix: pix,
        valor_dinheiro: dinheiro,
        valor_pago: result.valorPago,
        restante: result.restante,
      },
      severidade: "medium",
      categoria: "coleta",
      modulo: "coletas",
      titulo: "Pagamento de visita cassino corrigido",
      resumo: `Pago R$ ${result.valorPago.toFixed(2)} · restante R$ ${result.restante.toFixed(2)}`,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    success: true,
    valor_pago: result.valorPago,
    restante: result.restante,
  });
}
