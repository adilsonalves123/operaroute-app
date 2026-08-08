import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { PLANOS_PADRAO, type FaixaPontos } from "@/lib/pricing";
import { aplicarPlanoEmpresa } from "@/lib/billing/aplicar-plano";
import type { Nicho } from "@/lib/types/database";

export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  const { profile } = auth;

  let body: { nichos?: Nicho[]; quantidade_pontos?: FaixaPontos | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const planos = isAdminConfigured()
    ? (await loadPrecosPayload(createAdminClient())).planos
    : PLANOS_PADRAO;

  const empresaId = profile.empresa_id;
  if (!empresaId) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await aplicarPlanoEmpresa(supabase, {
    empresaId,
    nichos: body.nichos ?? [],
    quantidade_pontos: body.quantidade_pontos ?? "1-10",
    planos,
    ativarAssinatura: false,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, upgrade_url: "/planos" },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    nichos_ativos: result.nichos_ativos,
    quantidade_pontos: result.quantidade_pontos,
    plano: result.plano,
    limite_pontos: result.limite_pontos,
    max_nichos: result.max_nichos,
  });
}
