import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  linkAfiliado,
  normalizarCodigo,
  toPublicAfiliado,
  type AfiliadoRow,
} from "@/lib/afiliados/core";
import { hashSenhaAfiliado } from "@/lib/afiliados/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const origin = new URL(request.url).origin;

  const { data: afiliado, error } = await admin
    .from("plataforma_afiliados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !afiliado) {
    return NextResponse.json({ error: "Afiliado não encontrado." }, { status: 404 });
  }

  const [{ data: comissoes }, { data: empresas }, { data: eventos }] =
    await Promise.all([
      admin
        .from("plataforma_afiliado_comissoes")
        .select("*")
        .eq("afiliado_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("empresas")
        .select("id, nome_operacao, created_at, afiliado_atribuido_em, ciclo_cobranca")
        .eq("afiliado_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("plataforma_afiliado_eventos")
        .select("tipo, created_at")
        .eq("afiliado_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const row = afiliado as AfiliadoRow;
  return NextResponse.json({
    afiliado: {
      ...toPublicAfiliado(row),
      link: linkAfiliado(row.codigo, origin),
    },
    comissoes: comissoes ?? [],
    empresas: empresas ?? [],
    eventos: eventos ?? [],
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body.acao === "marcar_comissao") {
    const comissaoId = String(body.comissao_id ?? "");
    const status = body.status === "pago" ? "pago" : body.status === "cancelado" ? "cancelado" : "pendente";
    if (!comissaoId) {
      return NextResponse.json({ error: "comissao_id obrigatório." }, { status: 400 });
    }
    const { error } = await admin
      .from("plataforma_afiliado_comissoes")
      .update({
        status,
        pago_em: status === "pago" ? new Date().toISOString() : null,
      })
      .eq("id", comissaoId)
      .eq("afiliado_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.nome != null) patch.nome = String(body.nome).trim();
  if (body.whatsapp != null) patch.whatsapp = String(body.whatsapp).trim() || null;
  if (body.notas != null) patch.notas = String(body.notas).trim() || null;
  if (body.ativo != null) patch.ativo = Boolean(body.ativo);
  if (body.comissao_tipo === "fixo" || body.comissao_tipo === "percentual") {
    patch.comissao_tipo = body.comissao_tipo;
  }
  if (body.comissao_valor != null) {
    const n = Number(body.comissao_valor);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Comissão inválida." }, { status: 400 });
    }
    patch.comissao_valor = n;
  }
  if (body.codigo != null) {
    const c = normalizarCodigo(String(body.codigo));
    if (!c) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }
    patch.codigo = c;
  }
  if (body.senha) {
    if (String(body.senha).length < 6) {
      return NextResponse.json({ error: "Senha mínima 6 caracteres." }, { status: 400 });
    }
    patch.senha_hash = hashSenhaAfiliado(String(body.senha));
  }

  const { data, error } = await admin
    .from("plataforma_afiliados")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const row = data as AfiliadoRow;
  return NextResponse.json({
    afiliado: {
      ...toPublicAfiliado(row),
      link: linkAfiliado(row.codigo, origin),
    },
  });
}
