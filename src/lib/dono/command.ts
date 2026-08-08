import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildOverview,
  fetchTenantsPlataforma,
  type PlataformaOverview,
  type TenantResumo,
} from "@/lib/plataforma/tenants";

export type FunilStep = {
  id: string;
  label: string;
  count: number;
  pct_do_anterior: number | null;
};

export type DonoAlert = {
  id: string;
  severidade: "critical" | "high" | "info";
  titulo: string;
  detalhe: string;
  href?: string;
};

export type DonoCommandPayload = {
  overview: PlataformaOverview;
  funil: {
    visitas_7d: number;
    visitas_30d: number;
    visitas_login_30d: number;
    visitas_cadastro_30d: number;
    cadastros_total: number;
    cadastros_7d: number;
    nao_converteram_onboarding: number;
    converteram_onboarding: number;
    taxa_conversao_onboarding_pct: number;
    steps: FunilStep[];
    aviso_app: string;
  };
  pesquisa: {
    por_objetivo: { objetivo: string; count: number }[];
    possui_funcionarios: { sim: number; nao: number };
    por_nicho: { nicho: string; count: number }[];
    por_faixa: { faixa: string; count: number; mrr: number }[];
  };
  suporte: {
    humano_aberto: number;
    com_ia: number;
    resolvidos_7d: number;
    fila: {
      id: string;
      assunto: string | null;
      user_nome: string | null;
      empresa_id: string;
      last_message_at: string;
      modo: string;
    }[];
  };
  atividade: {
    sessoes_24h: number;
    sessoes_recentes: {
      id: string;
      user_nome: string | null;
      empresa_id: string | null;
      iniciado_em: string;
      dispositivo: string | null;
    }[];
  };
  alertas: DonoAlert[];
  acoes_sugeridas: { titulo: string; motivo: string; href: string }[];
  tenants: TenantResumo[];
  crm: {
    receita_mes_centavos: number;
    churn_30d: number;
    churn_rate_pct: number;
    assinaturas_ativas: number;
    planos_vendidos: { plano: string; count: number }[];
    ciclos: { mensal: number; anual: number };
    novos_por_mes: { mes: string; label: string; count: number }[];
    receita_por_mes: { mes: string; label: string; centavos: number }[];
    crescimento: { mes: string; label: string; total: number }[];
    clientes_recentes: {
      id: string;
      empresa: string;
      plano: string;
      status: string;
      saude: string;
      vencimento: string | null;
      ciclo: string;
    }[];
  };
};

function countTipo(rows: { tipo: string }[] | null | undefined) {
  const m: Record<string, number> = {};
  for (const r of rows ?? []) {
    m[r.tipo] = (m[r.tipo] ?? 0) + 1;
  }
  return m;
}

function pct(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round((atual / anterior) * 1000) / 10;
}

export async function buildDonoCommand(): Promise<DonoCommandPayload> {
  const admin = createAdminClient();
  const tenants = await fetchTenantsPlataforma(admin);

  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const desde7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const desde24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    suporteHumano,
    suporteIa,
    suporteResolvido7d,
    profilesTotal,
    profilesSemEmpresa,
    profiles7d,
    empresasExtra,
    filaSuporte,
  ] = await Promise.all([
    admin
      .from("suporte_conversas")
      .select("id", { count: "exact", head: true })
      .eq("modo", "humano"),
    admin
      .from("suporte_conversas")
      .select("id", { count: "exact", head: true })
      .eq("modo", "ia"),
    admin
      .from("suporte_conversas")
      .select("id", { count: "exact", head: true })
      .eq("modo", "resolvido")
      .gte("resolved_at", desde7),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("empresa_id", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde7),
    admin
      .from("empresas")
      .select("id, objetivo_principal, possui_funcionarios, nicho, quantidade_pontos"),
    admin
      .from("suporte_conversas")
      .select("id, assunto, user_nome, empresa_id, last_message_at, modo")
      .eq("modo", "humano")
      .order("last_message_at", { ascending: false })
      .limit(8),
  ]);

  let sessoes24Count = 0;
  let sessoesRecentesData: DonoCommandPayload["atividade"]["sessoes_recentes"] = [];
  {
    const [sessoes24, sessoesRecentes] = await Promise.all([
      admin
        .from("auditoria_sessoes")
        .select("id", { count: "exact", head: true })
        .gte("iniciado_em", desde24),
      admin
        .from("auditoria_sessoes")
        .select("id, user_nome, empresa_id, iniciado_em, dispositivo")
        .order("iniciado_em", { ascending: false })
        .limit(12),
    ]);
    if (!sessoes24.error) sessoes24Count = sessoes24.count ?? 0;
    if (!sessoesRecentes.error) {
      sessoesRecentesData =
        (sessoesRecentes.data as DonoCommandPayload["atividade"]["sessoes_recentes"]) ??
        [];
    }
  }

  let funil30: { tipo: string }[] | null = null;
  let funil7: { tipo: string }[] | null = null;
  {
    const [a, b] = await Promise.all([
      admin.from("plataforma_funil_eventos").select("tipo").gte("created_at", desde30),
      admin.from("plataforma_funil_eventos").select("tipo").gte("created_at", desde7),
    ]);
    if (!a.error) funil30 = a.data;
    if (!b.error) funil7 = b.data;
  }

  const funil30m = countTipo(funil30);
  const funil7m = countTipo(funil7);

  const objetivoMap = new Map<string, number>();
  const funcionarios = { sim: 0, nao: 0 };
  for (const e of empresasExtra.data ?? []) {
    const obj = e.objetivo_principal || "não informado";
    objetivoMap.set(obj, (objetivoMap.get(obj) ?? 0) + 1);
    if (e.possui_funcionarios) funcionarios.sim += 1;
    else funcionarios.nao += 1;
  }

  const overview = buildOverview(tenants, suporteHumano.count ?? 0);
  const cadastros = profilesTotal.count ?? 0;
  const semConversao = profilesSemEmpresa.count ?? 0;
  const converteram = Math.max(0, cadastros - semConversao);
  const taxaConversaoOnboarding =
    cadastros > 0 ? Math.round((converteram / cadastros) * 1000) / 10 : 0;

  const visitas7d =
    (funil7m.visita_login ?? 0) +
    (funil7m.visita_cadastro ?? 0) +
    (funil7m.visita_landing ?? 0);
  const visitas30d =
    (funil30m.visita_login ?? 0) +
    (funil30m.visita_cadastro ?? 0) +
    (funil30m.visita_landing ?? 0);

  const visitasCadastro = funil30m.visita_cadastro ?? 0;
  const trials = overview.trials;
  const ativos = overview.ativos;

  const steps: FunilStep[] = [
    {
      id: "visitas",
      label: "Visitas (30d)",
      count: visitas30d,
      pct_do_anterior: null,
    },
    {
      id: "cadastro_page",
      label: "Viu cadastro",
      count: visitasCadastro,
      pct_do_anterior: pct(visitasCadastro, visitas30d),
    },
    {
      id: "contas",
      label: "Criou conta",
      count: cadastros,
      pct_do_anterior: pct(cadastros, Math.max(visitasCadastro, visitas30d)),
    },
    {
      id: "onboarding",
      label: "Onboarding ok",
      count: converteram,
      pct_do_anterior: pct(converteram, cadastros),
    },
    {
      id: "trial",
      label: "Em trial",
      count: trials,
      pct_do_anterior: pct(trials, converteram),
    },
    {
      id: "ativos",
      label: "Ativos",
      count: ativos,
      pct_do_anterior: pct(ativos, Math.max(converteram, 1)),
    },
  ];

  const alertas: DonoAlert[] = [];
  if ((suporteHumano.count ?? 0) > 0) {
    alertas.push({
      id: "suporte",
      severidade: "critical",
      titulo: `${suporteHumano.count} ticket(s) aguardando você`,
      detalhe: "Clientes pediram atendimento humano.",
      href: "/dono/suporte",
    });
  }
  if (overview.trials_expirando > 0) {
    alertas.push({
      id: "trial",
      severidade: "high",
      titulo: `${overview.trials_expirando} trial(s) acabando em ≤3 dias`,
      detalhe: "Risco de churn — estenda trial ou ative assinatura.",
      href: "/dono/empresas?saude=trial_expirando",
    });
  }
  if (semConversao > 0) {
    alertas.push({
      id: "onboarding",
      severidade: "high",
      titulo: `${semConversao} cadastro(s) sem converter`,
      detalhe: "Conta criada, onboarding incompleto.",
      href: "/dono/funil",
    });
  }
  if (overview.trials_expirados > 0) {
    alertas.push({
      id: "expirado",
      severidade: "info",
      titulo: `${overview.trials_expirados} trial(s) expirado(s)`,
      detalhe: "Candidatos a reativação ou follow-up.",
      href: "/dono/empresas?saude=trial_expirado",
    });
  }
  if (overview.suspensos > 0) {
    alertas.push({
      id: "cancelados",
      severidade: "high",
      titulo: `${overview.suspensos} assinatura(s) suspensa(s)`,
      detalhe: "Contas canceladas ou bloqueadas.",
      href: "/dono/empresas?saude=suspenso",
    });
  }

  // CRM series — últimos 6 meses
  const meses: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    meses.push({ key, label, start: d, end });
  }

  const novos_por_mes = meses.map((m) => ({
    mes: m.key,
    label: m.label,
    count: tenants.filter((t) => {
      const c = new Date(t.created_at).getTime();
      return c >= m.start.getTime() && c < m.end.getTime();
    }).length,
  }));

  const crescimento = meses.map((m) => ({
    mes: m.key,
    label: m.label,
    total: tenants.filter((t) => new Date(t.created_at).getTime() < m.end.getTime())
      .length,
  }));

  let receita_por_mes = meses.map((m) => ({
    mes: m.key,
    label: m.label,
    centavos: 0,
  }));
  let receita_mes_centavos = 0;
  {
    const desde6 = meses[0]!.start.toISOString();
    const { data: pags } = await admin
      .from("plataforma_pagamentos")
      .select("valor_centavos, pago_em")
      .eq("status", "pago")
      .gte("pago_em", desde6);
    for (const p of pags ?? []) {
      const key = String(p.pago_em).slice(0, 7);
      const row = receita_por_mes.find((r) => r.mes === key);
      if (row) row.centavos += p.valor_centavos ?? 0;
    }
    const mesAtual = meses[meses.length - 1]!.key;
    receita_mes_centavos =
      receita_por_mes.find((r) => r.mes === mesAtual)?.centavos ?? 0;
  }

  const reais = tenants.filter((t) => t.cliente_real);

  // Churn real: trials expirados + suspensos entre a base relevante (não conta órfãs).
  const baseChurnPool = reais.filter(
    (t) =>
      t.saude === "ativo" ||
      t.saude === "trial" ||
      t.saude === "trial_expirando" ||
      t.saude === "trial_expirado" ||
      t.saude === "suspenso"
  );
  const churn_30d = reais.filter(
    (t) => t.saude === "suspenso" || t.saude === "trial_expirado"
  ).length;
  const baseChurn = Math.max(1, baseChurnPool.length);
  const churn_rate_pct =
    baseChurnPool.length === 0
      ? 0
      : Math.round((churn_30d / baseChurn) * 1000) / 10;

  const planoMap = new Map<string, number>();
  let mensal = 0;
  let anual = 0;
  let assinaturas_ativas = 0;
  for (const t of reais) {
    if (t.saude !== "ativo" && t.saude !== "trial" && t.saude !== "trial_expirando") {
      continue;
    }
    if (t.pagamento_confirmado) {
      const plano = (t.plano || "start").toLowerCase();
      planoMap.set(plano, (planoMap.get(plano) ?? 0) + 1);
      assinaturas_ativas += 1;
    }
    if (t.ciclo_cobranca === "anual") anual += 1;
    else mensal += 1;
  }

  // Planos vendidos = checkouts/pagamentos pagos (não flag de empresa)
  {
    const { data: planosPagos } = await admin
      .from("plataforma_pagamentos")
      .select("id, empresa_id")
      .eq("status", "pago");
    const { data: checkoutsPagos } = await admin
      .from("plataforma_checkout")
      .select("id, empresa_id, plano_nome")
      .eq("status", "pago");
    if ((planosPagos?.length ?? 0) === 0 && (checkoutsPagos?.length ?? 0) === 0) {
      planoMap.clear();
    } else if ((checkoutsPagos?.length ?? 0) > 0) {
      planoMap.clear();
      for (const c of checkoutsPagos ?? []) {
        const nome = (c.plano_nome || "Plano").toString();
        const key = nome.toLowerCase();
        planoMap.set(key, (planoMap.get(key) ?? 0) + 1);
      }
    }
  }

  const formatVenc = (t: TenantResumo) => {
    if (t.pagamento_confirmado && t.assinatura_vence_em) return t.assinatura_vence_em;
    if (t.trial_fim) return t.trial_fim;
    return null;
  };

  const statusLabel = (t: TenantResumo) => {
    if (t.saude === "ativo") return t.pagamento_confirmado ? "Ativo (pago)" : "Ativo";
    if (t.saude === "trial" || t.saude === "trial_expirando") return "Trial";
    if (t.saude === "trial_expirado") return "Expirado";
    if (t.saude === "suspenso") return "Cancelado";
    return "Inativo";
  };

  const clientes_recentes = [...reais]
    .filter((t) => t.saude !== "inativo")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 12)
    .map((t) => ({
      id: t.id,
      empresa: t.nome_operacao,
      plano: (t.plano || "start").replace(/^./, (c) => c.toUpperCase()),
      status: statusLabel(t),
      saude: t.saude,
      vencimento: formatVenc(t),
      ciclo: t.ciclo_cobranca,
    }));

  const acoes_sugeridas: DonoCommandPayload["acoes_sugeridas"] = [];
  for (const t of overview.em_risco.slice(0, 4)) {
    acoes_sugeridas.push({
      titulo: `Revisar ${t.nome_operacao}`,
      motivo:
        t.saude === "trial_expirando"
          ? "Trial acabando — oferecer extensão ou upgrade"
          : t.saude === "trial_expirado"
            ? "Trial expirado — reengajar ou suspender"
            : "Conta em risco",
      href: `/dono/empresas/${t.id}`,
    });
  }
  if ((suporteHumano.count ?? 0) > 0) {
    acoes_sugeridas.unshift({
      titulo: "Responder fila de suporte",
      motivo: "Clientes esperando resposta humana",
      href: "/dono/suporte",
    });
  }
  if (taxaConversaoOnboarding < 60 && cadastros >= 3) {
    acoes_sugeridas.push({
      titulo: "Melhorar conversão do onboarding",
      motivo: `Taxa atual ${taxaConversaoOnboarding}% — peça insights à IA`,
      href: "/dono/relatorios",
    });
  }

  return {
    overview,
    funil: {
      visitas_7d: visitas7d,
      visitas_30d: visitas30d,
      visitas_login_30d: funil30m.visita_login ?? 0,
      visitas_cadastro_30d: visitasCadastro,
      cadastros_total: cadastros,
      cadastros_7d: profiles7d.count ?? 0,
      nao_converteram_onboarding: semConversao,
      converteram_onboarding: converteram,
      taxa_conversao_onboarding_pct: taxaConversaoOnboarding,
      steps,
      aviso_app:
        "Instalações do app mobile ainda não entram no funil. Rode supabase/plataforma-funil.sql para visitas.",
    },
    pesquisa: {
      por_objetivo: Array.from(objetivoMap.entries())
        .map(([objetivo, count]) => ({ objetivo, count }))
        .sort((a, b) => b.count - a.count),
      possui_funcionarios: funcionarios,
      por_nicho: overview.por_nicho,
      por_faixa: overview.por_faixa,
    },
    suporte: {
      humano_aberto: suporteHumano.count ?? 0,
      com_ia: suporteIa.count ?? 0,
      resolvidos_7d: suporteResolvido7d.count ?? 0,
      fila: (filaSuporte.data ?? []) as DonoCommandPayload["suporte"]["fila"],
    },
    atividade: {
      sessoes_24h: sessoes24Count,
      sessoes_recentes: sessoesRecentesData,
    },
    alertas,
    acoes_sugeridas,
    tenants,
    crm: {
      receita_mes_centavos,
      churn_30d,
      churn_rate_pct,
      assinaturas_ativas,
      planos_vendidos: Array.from(planoMap.entries())
        .map(([plano, count]) => ({
          plano: plano.charAt(0).toUpperCase() + plano.slice(1),
          count,
        }))
        .sort((a, b) => b.count - a.count),
      ciclos: { mensal, anual },
      novos_por_mes,
      receita_por_mes,
      crescimento,
      clientes_recentes,
    },
  };
}

export function serializarContextoDono(cmd: DonoCommandPayload): string {
  return JSON.stringify(
    {
      overview: {
        mrr: cmd.overview.mrr_estimado,
        arr: cmd.overview.arr_estimado,
        arpu: cmd.overview.arpu,
        clientes: cmd.overview.total_empresas,
        ativos: cmd.overview.ativos,
        trials: cmd.overview.trials,
        trials_expirando: cmd.overview.trials_expirando,
        trials_expirados: cmd.overview.trials_expirados,
        novos_7d: cmd.overview.novos_7d,
        suporte_humano: cmd.overview.suporte_humano_aberto,
      },
      funil: cmd.funil,
      pesquisa: cmd.pesquisa,
      em_risco: cmd.overview.em_risco.map((t) => ({
        nome: t.nome_operacao,
        saude: t.saude,
        email: t.owner_email,
        nichos: t.nichos_ativos,
        mrr: t.mrr_estimado,
      })),
      recentes: cmd.overview.recentes.map((t) => ({
        nome: t.nome_operacao,
        saude: t.saude,
        nichos: t.nichos_ativos,
      })),
    },
    null,
    2
  );
}
