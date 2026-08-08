import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload, savePrecosPayload } from "@/lib/dono/precos";
import type { PlanoDefinicao } from "@/lib/pricing";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  const data = await loadPrecosPayload(admin);
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const planos = body.planos as PlanoDefinicao[] | undefined;
  const multiplicador_anual = Number(body.multiplicador_anual ?? 10);

  if (!planos?.length) {
    return NextResponse.json({ error: "Envie os 4 planos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await savePrecosPayload(admin, {
    planos,
    multiplicador_anual,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const data = await loadPrecosPayload(admin);
  return NextResponse.json({ ok: true, ...data });
}
