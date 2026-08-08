import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  buildNichoCardItens,
  loadNichoCardsMap,
  resetNichoCover,
  updateNichoCard,
  uploadNichoCover,
} from "@/lib/dono/nicho-covers";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";
import type { Nicho } from "@/lib/types/database";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({
      itens: buildNichoCardItens({}),
      fonte: "padrao",
    });
  }

  const admin = createAdminClient();
  const map = await loadNichoCardsMap(admin);
  return NextResponse.json({
    itens: buildNichoCardItens(map),
    fonte: "banco",
  });
}

export async function POST(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const admin = createAdminClient();

  if (contentType.includes("multipart/form-data")) {
    const form = await readRequestFormData(request);
    const nicho = String(form.get("nicho") ?? "") as Nicho;
    const file = asUploadFile(form.get("file"));
    if (!file) {
      return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
    }
    const result = await uploadNichoCover(admin, nicho, file);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, url: result.url, nicho });
  }

  const body = await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "");
  const nicho = String(body.nicho ?? "") as Nicho;
  if (!nicho) {
    return NextResponse.json({ error: "Nicho obrigatório." }, { status: 400 });
  }

  if (acao === "pausar" || acao === "ativar") {
    const result = await updateNichoCard(admin, nicho, {
      pausado: acao === "pausar",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, nicho, pausado: acao === "pausar" });
  }

  if (acao === "salvar") {
    const result = await updateNichoCard(admin, nicho, {
      label: body.label == null ? undefined : String(body.label),
      descricao: body.descricao == null ? undefined : String(body.descricao),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, nicho });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const nicho = String(body.nicho ?? "") as Nicho;
  if (!nicho) {
    return NextResponse.json({ error: "Nicho obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await resetNichoCover(admin, nicho);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, nicho });
}
