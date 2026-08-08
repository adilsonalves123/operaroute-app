import { NextResponse } from "next/server";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchVisitaPontoResumo, resolveNichosVisitaPonto } from "@/lib/visitas-ponto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const supabase = await createClient();
  const resumo = await fetchVisitaPontoResumo(supabase, profile.empresa_id, id);

  if (!resumo) {
    return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const nichosDisponiveis = resolveNichosVisitaPonto(nichosAtivos);

  const { data: itens } = await supabase
    .from("visita_ponto_itens")
    .select("id, nicho, ordem, created_at, cassino_visita_id, coleta_id, grupo_id")
    .eq("visita_ponto_id", id)
    .order("ordem");

  return NextResponse.json({
    resumo,
    itens: itens ?? [],
    nichosDisponiveis,
  });
}
