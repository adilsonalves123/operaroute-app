import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import type { ResumoRascunhoSnapshot } from "@/lib/rascunho/compartilhar";
import { gravarResumoRascunhoPublico } from "@/lib/rascunho/compartilhar-server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAcesso("dashboard", "ver");
  if (!auth.ok) return auth.response;

  if (!auth.empresa?.rascunho_dashboard_ativo) {
    return NextResponse.json({ error: "Menu Rascunho desativado." }, { status: 403 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor para links públicos.",
      },
      { status: 503 }
    );
  }

  let body: { snapshot?: ResumoRascunhoSnapshot };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const snapshot = body.snapshot;
  if (!snapshot?.dataISO || !Array.isArray(snapshot.pontos)) {
    return NextResponse.json({ error: "Snapshot do resumo inválido." }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { url } = await gravarResumoRascunhoPublico(
      db,
      auth.profile.empresa_id!,
      snapshot
    );
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar link." },
      { status: 500 }
    );
  }
}
