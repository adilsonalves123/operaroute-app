import { NextResponse } from "next/server";
import { getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isPlataformaStaff } from "@/lib/plataforma/staff";
import { fetchTenantsPlataforma } from "@/lib/plataforma/tenants";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { aplicarPlanoEmpresa } from "@/lib/billing/aplicar-plano";
import { loadPrecosPayload } from "@/lib/dono/precos";
import type { Nicho } from "@/lib/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isPlataformaStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const tenants = await fetchTenantsPlataforma(admin);
  const tenant = tenants.find((t) => t.id === id);
  if (!tenant) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const [{ count: coletas }, { count: financeiro }, { data: sessoes }] =
    await Promise.all([
      admin
        .from("coletas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", id),
      admin
        .from("financeiro")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", id),
      admin
        .from("auditoria_sessoes")
        .select("id, user_nome, iniciado_em, dispositivo")
        .eq("empresa_id", id)
        .order("iniciado_em", { ascending: false })
        .limit(10),
    ]);

  const { data: suporte } = await admin
    .from("suporte_conversas")
    .select("id, modo, assunto, last_message_at, user_nome")
    .eq("empresa_id", id)
    .order("last_message_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    tenant,
    uso: {
      coletas: coletas ?? 0,
      financeiro: financeiro ?? 0,
    },
    sessoes: sessoes ?? [],
    suporte: suporte ?? [],
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isPlataformaStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "");

  const admin = createAdminClient();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nome_operacao, status, owner_id, quantidade_pontos")
    .eq("id", id)
    .maybeSingle();

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  if (acao === "suspender") {
    await admin.from("empresas").update({ status: "suspenso" }).eq("id", id);
  } else if (acao === "reativar") {
    await admin.from("empresas").update({ status: "ativo" }).eq("id", id);
  } else if (acao === "assinatura") {
    const ativa = Boolean(body.assinatura_ativa);
    await admin
      .from("profiles")
      .update({ assinatura_ativa: ativa })
      .eq("empresa_id", id);
  } else if (acao === "estender_trial") {
    const dias = Math.min(90, Math.max(1, Number(body.dias) || 7));
    const { data: prof } = await admin
      .from("profiles")
      .select("trial_fim")
      .eq("empresa_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const base =
      prof?.trial_fim && new Date(prof.trial_fim).getTime() > Date.now()
        ? new Date(prof.trial_fim)
        : new Date();
    base.setDate(base.getDate() + dias);
    await admin
      .from("profiles")
      .update({ trial_fim: base.toISOString(), assinatura_ativa: true })
      .eq("empresa_id", id);
  } else if (acao === "definir_nichos") {
    const nichos = Array.isArray(body.nichos) ? (body.nichos as Nicho[]) : [];
    const faixa =
      typeof body.quantidade_pontos === "string"
        ? body.quantidade_pontos
        : empresa.quantidade_pontos ?? "1-10";
    const planos = (await loadPrecosPayload(admin)).planos;
    const result = await aplicarPlanoEmpresa(admin, {
      empresaId: id,
      nichos,
      quantidade_pontos: faixa,
      planos,
      permitirTrocaTravados: true,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }
  } else if (acao === "nota") {
    // stored as empresa observacao? use meta via auditoria only
  } else {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  await registrarAuditoria({
    supabase: admin,
    empresaId: id,
    userId: user.id,
    userNome: profile?.nome ?? "Plataforma",
    userEmail: user.email ?? profile?.email,
    userRole: "plataforma",
    acao: `plataforma.${acao}`,
    tabela: "empresas",
    registroId: id,
    dadosNovos: body as Record<string, unknown>,
    severidade: acao === "suspender" ? "critical" : "high",
    categoria: "sistema",
    modulo: "plataforma",
    titulo: `Plataforma · ${acao} · ${empresa.nome_operacao}`,
    resumo: `Ação do dono OperaRoute sobre o cliente`,
  });

  const tenants = await fetchTenantsPlataforma(admin);
  const tenant = tenants.find((t) => t.id === id);
  return NextResponse.json({ success: true, tenant });
}
