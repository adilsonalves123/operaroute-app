import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { fetchRascunhoDia } from "@/lib/pontos/rascunho-dia";

/** Valores por ponto no dia ou no período (coletas/visitas) para a folha do Rascunho. */
export async function GET(request: Request) {
  const auth = await requireAcesso("dashboard", "ver");
  if (!auth.ok) return auth.response;

  const { profile, supabase, empresa } = auth;

  if (auth.acesso.visaoRestrita) {
    return NextResponse.json({ error: "Menu Rascunho desativado." }, { status: 403 });
  }

  if (!empresa?.rascunho_dashboard_ativo) {
    return NextResponse.json({ error: "Menu Rascunho desativado." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const data = params.get("data") || params.get("de");
  const ate = params.get("ate");
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { error: "Informe data no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (ate && !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json(
      { error: "Informe ate no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const dados = await fetchRascunhoDia(
    supabase,
    profile.empresa_id!,
    data,
    ate ?? undefined
  );
  return NextResponse.json(dados);
}
