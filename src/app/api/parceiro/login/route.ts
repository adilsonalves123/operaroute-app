import {
  afiliadoCookieOptions,
  createAfiliadoToken,
  verificarSenhaAfiliado,
} from "@/lib/afiliados/senha";
import {
  AFILIADO_REF_COOKIE,
  AFILIADO_SESSION_COOKIE,
  type AfiliadoRow,
} from "@/lib/afiliados/core";
import { getAfiliadoSession } from "@/lib/afiliados/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAfiliadoSession();
  if (!session) {
    return NextResponse.json({ autenticado: false });
  }
  return NextResponse.json({ autenticado: true, session });
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  if (!email || !senha) {
    return NextResponse.json({ error: "E-mail e senha obrigatórios." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plataforma_afiliados")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }
  const row = data as AfiliadoRow;
  if (!row.ativo) {
    return NextResponse.json({ error: "Conta pausada. Fale com o OperaRoute." }, { status: 403 });
  }
  if (!verificarSenhaAfiliado(senha, row.senha_hash)) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const token = createAfiliadoToken(row);
  const jar = await cookies();
  jar.set(AFILIADO_SESSION_COOKIE, token, afiliadoCookieOptions());

  return NextResponse.json({
    ok: true,
    afiliado: {
      id: row.id,
      nome: row.nome,
      codigo: row.codigo,
      email: row.email,
    },
  });
}

export async function DELETE() {
  const jar = await cookies();
  jar.set(AFILIADO_SESSION_COOKIE, "", { ...afiliadoCookieOptions(), maxAge: 0 });
  return NextResponse.json({ ok: true });
}

export { AFILIADO_REF_COOKIE };
