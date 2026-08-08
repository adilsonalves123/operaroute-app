import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchTenantsPlataforma } from "@/lib/plataforma/tenants";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { aplicarPlanoEmpresa } from "@/lib/billing/aplicar-plano";
import { loadPrecosPayload } from "@/lib/dono/precos";
import type { Nicho } from "@/lib/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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

  const [{ count: coletas }, { count: financeiro }, { data: sessoes }, { data: empresaExtra }] =
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
      admin
        .from("empresas")
        .select("objetivo_principal, possui_funcionarios")
        .eq("id", id)
        .maybeSingle(),
    ]);

  const { data: suporte } = await admin
    .from("suporte_conversas")
    .select("id, modo, assunto, last_message_at, user_nome")
    .eq("empresa_id", id)
    .order("last_message_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    tenant,
    pesquisa: {
      objetivo_principal: empresaExtra?.objetivo_principal ?? null,
      possui_funcionarios: empresaExtra?.possui_funcionarios ?? null,
    },
    uso: {
      coletas: coletas ?? 0,
      financeiro: financeiro ?? 0,
    },
    sessoes: sessoes ?? [],
    suporte: suporte ?? [],
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
  } else if (acao === "cortesia" || acao === "estender_trial") {
    // Prioriza o perfil do owner — é ele que o AppShell usa para liberar/bloquear.
    const [{ data: ownerProf }, { data: firstProf }] = await Promise.all([
      empresa.owner_id
        ? admin
            .from("profiles")
            .select("trial_fim")
            .eq("user_id", empresa.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("trial_fim")
        .eq("empresa_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const prof = ownerProf ?? firstProf;

    let fim: Date;

    if (body.data_fim) {
      // Data absoluta (fim do dia local → ISO)
      const raw = String(body.data_fim).trim();
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T23:59:59`)
        : new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      }
      fim = parsed;
    } else {
      const unidade = body.unidade === "meses" ? "meses" : "dias";
      const qtd = Math.min(
        unidade === "meses" ? 120 : 3650,
        Math.max(1, Math.floor(Number(body.quantidade ?? body.dias) || 0))
      );
      if (!qtd) {
        return NextResponse.json(
          { error: "Informe a quantidade de dias ou meses." },
          { status: 400 }
        );
      }
      const modo = body.modo === "definir_a_partir_de_hoje" ? "hoje" : "somar";
      const base =
        modo === "hoje"
          ? new Date()
          : prof?.trial_fim && new Date(prof.trial_fim).getTime() > Date.now()
            ? new Date(prof.trial_fim)
            : new Date();
      if (unidade === "meses") {
        base.setMonth(base.getMonth() + qtd);
      } else {
        base.setDate(base.getDate() + qtd);
      }
      fim = base;
    }

    if (fim.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "A data de cortesia não pode ficar no passado." },
        { status: 400 }
      );
    }

    const cortesiaPayload = {
      trial_fim: fim.toISOString(),
      assinatura_ativa: true,
    };

    await admin.from("profiles").update(cortesiaPayload).eq("empresa_id", id);

    // Garante o owner mesmo se o profile.empresa_id estiver desalinhado.
    if (empresa.owner_id) {
      await admin
        .from("profiles")
        .update({
          ...cortesiaPayload,
          empresa_id: id,
        })
        .eq("user_id", empresa.owner_id);
    }

    // Guarda motivo só no log de auditoria (body já vai em dadosNovos)
  } else if (acao === "ciclo") {
    const ciclo = body.ciclo === "anual" ? "anual" : "mensal";
    const { error } = await admin
      .from("empresas")
      .update({ ciclo_cobranca: ciclo })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        {
          error:
            error.message.includes("ciclo_cobranca")
              ? "Rode supabase/plataforma-receita.sql no Supabase."
              : error.message,
        },
        { status: 500 }
      );
    }
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
  } else {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  await registrarAuditoria({
    supabase: admin,
    empresaId: id,
    userId: null,
    userNome: "Dono OperaRoute",
    userEmail: session.email,
    userRole: "dono",
    acao: `dono.${acao}`,
    tabela: "empresas",
    registroId: id,
    dadosNovos: body as Record<string, unknown>,
    severidade: acao === "suspender" ? "critical" : "high",
    categoria: "sistema",
    modulo: "dono",
    titulo: `Dono · ${acao} · ${empresa.nome_operacao}`,
    resumo: `Ação do painel do dono sobre o cliente`,
  });

  const tenants = await fetchTenantsPlataforma(admin);
  const tenant = tenants.find((t) => t.id === id);
  return NextResponse.json({ success: true, tenant });
}
