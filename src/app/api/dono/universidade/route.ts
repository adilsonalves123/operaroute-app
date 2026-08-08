import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  criarUniversidadeAula,
  excluirUniversidadeAula,
  loadUniversidadeAulasAdmin,
  saveUniversidadeAula,
  seedUniversidadeAulasSeVazio,
} from "@/lib/dono/universidade-aulas";
import type { UniversidadeModulo } from "@/lib/universidade/aulas";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  await seedUniversidadeAulasSeVazio(admin).catch(() => null);
  const data = await loadUniversidadeAulasAdmin(admin);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const result = await criarUniversidadeAula(admin, {
    titulo: body.titulo ? String(body.titulo) : undefined,
    modulo: body.modulo as UniversidadeModulo | undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await loadUniversidadeAulasAdmin(admin);
  return NextResponse.json({ ok: true, aula: result.aula, ...data });
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
  const admin = createAdminClient();
  const result = await saveUniversidadeAula(admin, {
    id: String(body.id ?? ""),
    titulo: String(body.titulo ?? ""),
    descricao: String(body.descricao ?? ""),
    modulo: body.modulo as UniversidadeModulo,
    duracao: String(body.duracao ?? ""),
    youtubeUrlOrId: body.youtubeUrlOrId ?? body.youtubeId ?? null,
    publicado: body.publicado !== false,
    ordem: body.ordem != null ? Number(body.ordem) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await loadUniversidadeAulasAdmin(admin);
  return NextResponse.json({ ok: true, aula: result.aula, ...data });
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
  const id = String(body.id ?? "");
  const admin = createAdminClient();
  const result = await excluirUniversidadeAula(admin, id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await loadUniversidadeAulasAdmin(admin);
  return NextResponse.json({ ok: true, ...data });
}
