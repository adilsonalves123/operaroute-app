import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcPrecoAnual,
  calcPrecoMensal,
} from "@/lib/pricing";
import { loadPrecosPayload } from "@/lib/dono/precos";
import type { TenantResumo } from "@/lib/plataforma/tenants";

export type CicloCobranca = "mensal" | "anual";

export type PagamentoSaaS = {
  id: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  ciclo: CicloCobranca;
  valor_centavos: number;
  status: string;
  metodo: string | null;
  referencia: string | null;
  observacao: string | null;
  pago_em: string;
  created_at: string;
};

export type ReceitaPeriodo = {
  arrecadado_centavos: number;
  qtd_pagamentos: number;
  mensal_centavos: number;
  anual_centavos: number;
  qtd_mensal: number;
  qtd_anual: number;
};

export type ReceitaDashboard = {
  periodos: {
    hoje: ReceitaPeriodo;
    semana: ReceitaPeriodo;
    mes: ReceitaPeriodo;
    ano: ReceitaPeriodo;
  };
  planos: {
    mensal: number;
    anual: number;
    sem_ciclo: number;
    ativos_pagantes: number;
    trial: number;
  };
  previsto: {
    mrr_centavos: number;
    arr_centavos: number;
    receita_mensal_equiv_centavos: number;
  };
  serie_30d: { dia: string; centavos: number; qtd: number }[];
  recentes: PagamentoSaaS[];
  aviso: string;
};

function emptyPeriodo(): ReceitaPeriodo {
  return {
    arrecadado_centavos: 0,
    qtd_pagamentos: 0,
    mensal_centavos: 0,
    anual_centavos: 0,
    qtd_mensal: 0,
    qtd_anual: 0,
  };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 domingo
  const diff = day === 0 ? 6 : day - 1; // segunda = início
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function startOfYear(d: Date) {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}

function acumular(
  p: ReceitaPeriodo,
  row: { ciclo: string; valor_centavos: number }
) {
  p.arrecadado_centavos += row.valor_centavos;
  p.qtd_pagamentos += 1;
  if (row.ciclo === "anual") {
    p.anual_centavos += row.valor_centavos;
    p.qtd_anual += 1;
  } else {
    p.mensal_centavos += row.valor_centavos;
    p.qtd_mensal += 1;
  }
}

export async function buildReceitaDashboard(
  admin: SupabaseClient,
  tenants: TenantResumo[]
): Promise<ReceitaDashboard> {
  const agora = new Date();
  const hojeIni = startOfDay(agora).toISOString();
  const semanaIni = startOfWeek(agora).toISOString();
  const mesIni = startOfMonth(agora).toISOString();
  const anoIni = startOfYear(agora).toISOString();
  const d30 = new Date(agora);
  d30.setDate(d30.getDate() - 29);
  const desde30 = startOfDay(d30).toISOString();

  let pagamentos: PagamentoSaaS[] = [];
  let ciclosMap = new Map<string, CicloCobranca>();
  let tabelaOk = true;

  {
    const { data, error } = await admin
      .from("plataforma_pagamentos")
      .select(
        "id, empresa_id, empresa_nome, ciclo, valor_centavos, status, metodo, referencia, observacao, pago_em, created_at"
      )
      .eq("status", "pago")
      .gte("pago_em", anoIni)
      .order("pago_em", { ascending: false })
      .limit(2000);

    if (error) {
      tabelaOk = false;
    } else {
      pagamentos = (data as PagamentoSaaS[]) ?? [];
    }
  }

  for (const t of tenants) {
    ciclosMap.set(t.id, t.ciclo_cobranca ?? "mensal");
  }

  const pagamentosAno = pagamentos;

  const periodos = {
    hoje: emptyPeriodo(),
    semana: emptyPeriodo(),
    mes: emptyPeriodo(),
    ano: emptyPeriodo(),
  };

  for (const p of pagamentosAno) {
    const t = new Date(p.pago_em).getTime();
    if (t >= new Date(hojeIni).getTime()) acumular(periodos.hoje, p);
    if (t >= new Date(semanaIni).getTime()) acumular(periodos.semana, p);
    if (t >= new Date(mesIni).getTime()) acumular(periodos.mes, p);
    if (t >= new Date(anoIni).getTime()) acumular(periodos.ano, p);
  }

  const serieMap = new Map<string, { centavos: number; qtd: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(d30);
    d.setDate(d30.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    serieMap.set(key, { centavos: 0, qtd: 0 });
  }
  for (const p of pagamentos) {
    const key = p.pago_em.slice(0, 10);
    const cur = serieMap.get(key);
    if (cur) {
      cur.centavos += p.valor_centavos;
      cur.qtd += 1;
    }
  }
  const serie_30d = Array.from(serieMap.entries()).map(([dia, v]) => ({
    dia,
    centavos: v.centavos,
    qtd: v.qtd,
  }));

  let mensal = 0;
  let anual = 0;
  let ativos = 0;
  let trial = 0;
  let mrr = 0;
  let receitaMensalEquiv = 0;

  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos;
  const multAnual = precos.multiplicador_anual;

  for (const t of tenants) {
    if (!t.cliente_real) continue;

    const ciclo = t.ciclo_cobranca ?? ciclosMap.get(t.id) ?? "mensal";
    const isTrialOnly =
      t.saude === "trial" || t.saude === "trial_expirando";
    const pagante = t.pagamento_confirmado;

    if (isTrialOnly) trial += 1;

    if (pagante || isTrialOnly) {
      if (ciclo === "anual") anual += 1;
      else mensal += 1;
    }

    if (pagante) {
      ativos += 1;
      // Preferir MRR pago; fallback catálogo só se mrr_pago já veio preenchido como 0 com pagamento.
      const pago = t.mrr_pago > 0 ? t.mrr_pago : null;
      const precoM =
        pago ??
        calcPrecoMensal(
          t.quantidade_pontos ?? "1-10",
          t.nichos_ativos,
          planos
        );
      const precoA = calcPrecoAnual(
        t.quantidade_pontos ?? "1-10",
        t.nichos_ativos,
        planos,
        multAnual
      );
      if (precoM != null) {
        mrr += precoM;
        if (ciclo === "anual" && precoA != null && pago == null) {
          receitaMensalEquiv += Math.round(precoA / 12);
        } else {
          receitaMensalEquiv += precoM;
        }
      }
    }
  }

  const recentes = [...pagamentosAno]
    .sort((a, b) => new Date(b.pago_em).getTime() - new Date(a.pago_em).getTime())
    .slice(0, 20);

  return {
    periodos,
    planos: {
      mensal,
      anual,
      sem_ciclo: 0,
      ativos_pagantes: ativos,
      trial,
    },
    previsto: {
      mrr_centavos: Math.round(mrr * 100),
      arr_centavos: Math.round(mrr * 12 * 100),
      receita_mensal_equiv_centavos: Math.round(receitaMensalEquiv * 100),
    },
    serie_30d,
    recentes,
    aviso: tabelaOk
      ? "Arrecadação = pagamentos registrados. MRR previsto só conta clientes com pagamento confirmado."
      : "Rode supabase/plataforma-receita.sql no Supabase para ativar arrecadação e ciclo mensal/anual.",
  };
}

export async function fetchCicloEmpresa(
  admin: SupabaseClient,
  empresaId: string
): Promise<CicloCobranca> {
  const { data } = await admin
    .from("empresas")
    .select("ciclo_cobranca")
    .eq("id", empresaId)
    .maybeSingle();
  return data?.ciclo_cobranca === "anual" ? "anual" : "mensal";
}
