import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: visita } = await supabase
    .from("visitas_ponto")
    .select("id, status")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!visita) {
    return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  }

  if (visita.status !== "rascunho") {
    return NextResponse.json({ error: "Só é possível cancelar visitas em rascunho." }, { status: 400 });
  }

  const { error } = await supabase
    .from("visitas_ponto")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "visita_ponto.cancelar",
    tabela: "visitas_ponto",
    registroId: id,
    severidade: "medium",
    categoria: "coleta",
    modulo: "coletas",
    titulo: "Cancelou visita em rascunho",
    resumo: `Visita ${id}`,
  });

  return NextResponse.json({ success: true });
}
