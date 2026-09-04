import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { corrigirPagamentoColeta } from "@/lib/coletas/corrigir-pagamento-coleta";
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

  const { data: coleta } = await supabase
    .from("coletas")
    .select("id, pontos(nome)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

  const pontoNome =
    (coleta.pontos as { nome?: string } | null)?.nome ?? null;

  const result = await corrigirPagamentoColeta(supabase, {
    empresaId: profile.empresa_id,
    coletaId: id,
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
      acao: "coleta.corrigir_pagamento",
      tabela: "coletas",
      registroId: id,
      dadosNovos: {
        valor_pix: pix,
        valor_dinheiro: dinheiro,
        valor_pago: result.valorPago,
        saldo_pendente: result.saldoPendente,
      },
      severidade: "medium",
      categoria: "coleta",
      modulo: "coletas",
      titulo: "Pagamento de coleta corrigido",
      resumo: `Pago R$ ${result.valorPago.toFixed(2)} · pendente R$ ${result.saldoPendente.toFixed(2)}`,
    });
  } catch {
    /* ignore */
  }

  const { pushColetaEditada } = await import("@/lib/push/events");
  pushColetaEditada({
    empresaId: profile.empresa_id,
    autorUserId: profile.user_id,
    autorNome: profile.nome,
    pontoNome,
    nichoLabel: "Coleta",
    valor: result.valorPago,
    coletaId: id,
    url: "/coletas",
  });

  return NextResponse.json({
    success: true,
    valor_pago: result.valorPago,
    saldo_pendente: result.saldoPendente,
  });
}
