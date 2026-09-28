import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  loadProvaSocial,
  saveProvaSocial,
  uploadFotoDepoimento,
} from "@/lib/marketing/prova-social-server";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";

async function exigirDono() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }
  return null;
}

export async function GET() {
  const bloqueio = await exigirDono();
  if (bloqueio) return bloqueio;
  const prova = await loadProvaSocial(createAdminClient());
  return NextResponse.json({ prova });
}

export async function PUT(request: Request) {
  const bloqueio = await exigirDono();
  if (bloqueio) return bloqueio;
  const body = await request.json().catch(() => ({}));
  const result = await saveProvaSocial(createAdminClient(), body.prova);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  revalidatePath("/");
  return NextResponse.json({ ok: true, prova: result.prova });
}

/** Upload da foto de um depoimento — devolve a URL pública. */
export async function POST(request: Request) {
  const bloqueio = await exigirDono();
  if (bloqueio) return bloqueio;
  const form = await readRequestFormData(request);
  const file = asUploadFile(form.get("file"));
  if (!file) {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }
  const result = await uploadFotoDepoimento(createAdminClient(), file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
