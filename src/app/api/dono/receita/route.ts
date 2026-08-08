import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchTenantsPlataforma } from "@/lib/plataforma/tenants";
import { buildReceitaDashboard, type CicloCobranca } from "@/lib/dono/receita";
import { calcPrecoCiclo } from "@/lib/pricing";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { criarComissaoSeAfiliado } from "@/lib/afiliados/core";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  const tenants = await fetchTenantsPlataforma(admin);
  const [dashboard, precos] = await Promise.all([
    buildReceitaDashboard(admin, tenants),
    loadPrecosPayload(admin),
  ]);

  return NextResponse.json({
    ...dashboard,
    clientes: tenants.map((t) => ({
      id: t.id,
      nome: t.nome_operacao,
      ciclo: t.ciclo_cobranca,
      saude: t.saude,
      assinatura_ativa: t.assinatura_ativa,
      mrr_estimado: t.mrr_estimado,
      preco_ciclo: calcPrecoCiclo(
        t.ciclo_cobranca,
        t.quantidade_pontos ?? "1-10",
        t.nichos_ativos,
        precos.planos,
        precos.multiplicador_anual
      ),
      owner_email: t.owner_email,
    })),
  });
}

/** Registrar pagamento ou alterar ciclo */
export async function POST(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const acao = String(body.acao ?? "registrar");
  const admin = createAdminClient();

  if (acao === "ciclo") {
    const empresaId = String(body.empresa_id ?? "");
    const ciclo = body.ciclo === "anual" ? "anual" : "mensal";
    if (!empresaId) {
      return NextResponse.json({ error: "empresa_id obrigatório." }, { status: 400 });
    }
    const { error } = await admin
      .from("empresas")
      .update({ ciclo_cobranca: ciclo })
      .eq("id", empresaId);
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
    return NextResponse.json({ ok: true, ciclo });
  }

  // registrar pagamento
  const empresaId = body.empresa_id ? String(body.empresa_id) : null;
  const ciclo: CicloCobranca = body.ciclo === "anual" ? "anual" : "mensal";
  const valorReais = Number(body.valor);
  if (!Number.isFinite(valorReais) || valorReais <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  let empresaNome = body.empresa_nome ? String(body.empresa_nome) : null;
  if (empresaId && !empresaNome) {
    const { data } = await admin
      .from("empresas")
      .select("nome_operacao")
      .eq("id", empresaId)
      .maybeSingle();
    empresaNome = data?.nome_operacao ?? null;
  }

  const pagoEm = body.pago_em
    ? new Date(String(body.pago_em)).toISOString()
    : new Date().toISOString();

  const { data, error } = await admin
    .from("plataforma_pagamentos")
    .insert({
      empresa_id: empresaId,
      empresa_nome: empresaNome,
      ciclo,
      valor_centavos: Math.round(valorReais * 100),
      status: "pago",
      metodo: String(body.metodo ?? "manual"),
      referencia: body.referencia ? String(body.referencia) : null,
      observacao: body.observacao ? String(body.observacao) : null,
      pago_em: pagoEm,
      created_by: session.email,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("plataforma_pagamentos") || error.code === "42P01"
            ? "Rode supabase/plataforma-receita.sql no Supabase."
            : error.message,
      },
      { status: 500 }
    );
  }

  if (empresaId) {
    await admin
      .from("empresas")
      .update({ ciclo_cobranca: ciclo })
      .eq("id", empresaId);
    await admin
      .from("profiles")
      .update({ assinatura_ativa: true })
      .eq("empresa_id", empresaId);

    await registrarAuditoria({
      supabase: admin,
      empresaId,
      userId: null,
      userNome: "Dono OperaRoute",
      userEmail: session.email,
      userRole: "dono",
      acao: "dono.pagamento",
      tabela: "plataforma_pagamentos",
      registroId: data.id,
      dadosNovos: { ciclo, valor: valorReais },
      severidade: "high",
      categoria: "sistema",
      modulo: "dono",
      titulo: `Pagamento ${ciclo} · ${empresaNome ?? "cliente"}`,
      resumo: `Arrecadação registrada: R$ ${valorReais.toFixed(2)}`,
    });

    await criarComissaoSeAfiliado(admin, {
      empresa_id: empresaId,
      empresa_nome: empresaNome ?? undefined,
      base_reais: valorReais,
      referencia: data.id,
    });
  }

  return NextResponse.json({ ok: true, pagamento: data });
}
