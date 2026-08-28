import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import type { ResumoRascunhoSnapshot } from "@/lib/rascunho/compartilhar";
import { gravarResumoRascunhoPublico } from "@/lib/rascunho/compartilhar-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAcesso("dashboard", "ver");
  if (!auth.ok) return auth.response;

  if (!auth.empresa?.rascunho_dashboard_ativo) {
    return NextResponse.json({ error: "Menu Rascunho desativado." }, { status: 403 });
  }

  let body: { snapshot?: ResumoRascunhoSnapshot; origin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const snapshot = body.snapshot;
  if (!snapshot?.dataISO || !Array.isArray(snapshot.pontos)) {
    return NextResponse.json({ error: "Snapshot do resumo inválido." }, { status: 400 });
  }

  const origin =
    typeof body.origin === "string" && body.origin.startsWith("http")
      ? body.origin
      : new URL(request.url).origin;

  try {
    const { url } = await gravarResumoRascunhoPublico(
      auth.supabase,
      auth.profile.empresa_id!,
      snapshot,
      origin
    );
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar link." },
      { status: 500 }
    );
  }
}
