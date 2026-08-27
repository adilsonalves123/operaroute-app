import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { fetchRascunhoDia } from "@/lib/pontos/rascunho-dia";

/** Valores por ponto no dia (coletas/visitas) para preencher a folha do Rascunho. */
export async function GET(request: Request) {
  const auth = await requireAcesso("dashboard", "ver");
  if (!auth.ok) return auth.response;

  const { profile, supabase, empresa } = auth;

  if (!empresa?.rascunho_dashboard_ativo) {
    return NextResponse.json({ error: "Menu Rascunho desativado." }, { status: 403 });
  }

  const data = new URL(request.url).searchParams.get("data");
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { error: "Informe data no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const dados = await fetchRascunhoDia(supabase, profile.empresa_id!, data);
  return NextResponse.json(dados);
}
