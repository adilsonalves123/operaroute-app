import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { NICHO_MODULO_DIVERSAO } from "@/lib/nichos/diversao";

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
    .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
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

  const { error: deleteError } = await supabase.from("coletas").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
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
    titulo: "Apagou coleta diversão",
    resumo: `Ponto ${coleta.ponto_id} · valor ${coleta.valor_liquido ?? coleta.lucro_real ?? "—"}`,
  });

  return NextResponse.json({ success: true });
}
