import { getNichoConfig, type NichoConfig } from "@/lib/nicho";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";
import { createClient } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getCassinoDashboardStats } from "@/lib/nichos/cassino/dashboard-stats";
import { getFuraFuraDashboardStats } from "@/lib/nichos/fura-fura/dashboard-stats";
import { getUrsinhoDashboardStats } from "@/lib/nichos/ursinho/dashboard-stats";
import { getDiversaoDashboardStats } from "@/lib/nichos/diversao/dashboard-stats";
import { getBolinhaDashboardStats } from "@/lib/nichos/bolinha/dashboard-stats";
import { getConsignadoDashboardStats } from "@/lib/nichos/consignado/dashboard-stats";
import {
  dashboardNichosLabel,
  getDashboardNichosAtivos,
  isDashboardMultiNicho,
  type DashboardNichoId,
} from "@/lib/dashboard-nichos-ativos";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import type { DashboardPeriodoFiltro } from "@/lib/dashboard-periodo";
import { fetchChamadosAbertosResumo } from "@/lib/chamados/fetch-resumo";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import {
  fetchComissaoStaffPeriodo,
  filtrarComissaoStaffParaViewer,
} from "@/lib/equipe/comissao-staff-periodo";
import type { DashboardRankingPoint } from "@/components/dashboard/DashboardRanking";
import type { DashSlice } from "@/components/dashboard/DashboardMultiNichoTabs";
import { getDashboardConsolidado } from "@/lib/dashboard-consolidado";
import {
  computePulsoOperacao,
  type PulsoEvento,
  type PulsoOperacao,
} from "@/lib/dashboard-pulso";
import {
  computeCartelaPontos,
  fetchCartelaPontos,
  type CartelaPontos,
} from "@/lib/dashboard-cartela-pontos";
import {
  aplicarClassificacaoSaudePorLucro,
  computeSaudePontos,
  fetchSaudePontos,
  type SaudePontosResumo,
} from "@/lib/dashboard-saude-pontos";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import { fetchDashboardPontosBase } from "@/lib/dashboard-pontos-base";
import { fetchPendenciasAbertas } from "@/lib/dashboard-pendencias-abertas";
import type { Nicho } from "@/lib/types/database";
import {
  insightUpgradePesquisa,
  parsePesquisaOnboarding,
} from "@/lib/onboarding/pesquisa";
import { resumoTrialPorFaixa } from "@/lib/onboarding/trial-resumo";
import { DashboardPremiumClient } from "@/components/dashboard/DashboardPremiumClient";
import type {
  DashboardKpi,
  DashboardNichoLinha,
  DashboardPremiumData,
  DashboardQuickAction,
  DashboardRankItem,
} from "@/components/dashboard/dashboard-premium-types";

function coletasToPulsoEventos(
  coletas: {
    id: string;
    ponto_id: string;
    visita_id: string | null;
    created_at: string;
    lucro_centavos: number | null;
    valor_liquido: number | null;
    valor_bruto: number | null;
    entrada: number | null;
  }[]
): PulsoEvento[] {
  const grupos = new Map<
    string,
    { lucroReais: number; negativa: boolean; created_at: string }
  >();

  for (const c of coletas) {
    const key = c.visita_id ?? `${c.ponto_id}:${c.created_at.slice(0, 10)}`;
    const lucro =
      c.lucro_centavos != null
        ? centesimosToReais(Number(c.lucro_centavos))
        : Number(c.valor_liquido ?? c.valor_bruto ?? c.entrada ?? 0);
    const prev = grupos.get(key);
    if (prev) {
      prev.lucroReais += lucro;
      prev.negativa = prev.negativa || lucro < -0.009;
    } else {
      grupos.set(key, {
        lucroReais: lucro,
        negativa: lucro < -0.009,
        created_at: c.created_at,
      });
    }
  }

  return [...grupos.values()].map((g) => ({
    created_at: g.created_at,
    lucroReais: g.lucroReais,
    negativa: g.negativa || g.lucroReais < -0.009,
  }));
}

const HERO_STAT_KEYS = new Set([
  "entrada_total",
  "saida_total",
  "saldo_liquido",
  "total_mes",
  "receita_mes",
  "lucro_estimado",
]);

const WARNING_KPI_KEYS = new Set([
  "pendencias",
  "pontos_pendentes",
  "tarefas_abertas",
  "a_receber_pendente",
]);

const CURRENCY_KPI_KEYS = new Set([
  "lucro_estimado",
  "a_receber_pendente",
  "haver_ponto",
  "custo_brindes",
  "saldo_liquido",
  "entrada_total",
  "saida_total",
  "total_mes",
  "receita_mes",
]);

function sparklineFromDailyValues(rows: { created_at: string; value: number }[]): number[] {
  const buckets = Array(7).fill(0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const row of rows) {
    const day = new Date(row.created_at);
    day.setHours(0, 0, 0, 0);
    const diffDays = Math.round((now.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays < 7) {
      buckets[6 - diffDays] += row.value;
    }
  }
  return buckets;
}

async function getDashboardStats(
  empresaId: string,
  _nicho: Nicho,
  periodo: DashboardPeriodoFiltro
) {
  const supabase = await createClient();
  const now = new Date();
  const { inicioISO, fimISO } = periodo;
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const lookbackISO = inicioISO < thirtyFiveDaysAgo ? inicioISO : thirtyFiveDaysAgo;

  const [
    { data: coletas },
    { data: coletasPulso },
    pontos,
    pendenciasAbertas,
    { data: estoque },
  ] = await Promise.all([
    supabase
      .from("coletas")
      .select("valor_bruto, valor_liquido, entrada, saida, ponto_id, created_at")
      .eq("empresa_id", empresaId)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO),
    supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_centavos, valor_liquido, valor_bruto, entrada"
      )
      .eq("empresa_id", empresaId)
      .gte("created_at", lookbackISO)
      .lte("created_at", fimISO),
    fetchDashboardPontosBase(supabase, empresaId),
    fetchPendenciasAbertas(supabase, empresaId),
    supabase.from("estoque").select("quantidade").eq("empresa_id", empresaId),
  ]);

  const pendenciasCount = pendenciasAbertas.length;
  const totalBruto = coletas?.reduce((s, c) => s + Number(c.valor_bruto ?? c.entrada ?? 0), 0) ?? 0;
  const totalLiquido = coletas?.reduce((s, c) => s + Number(c.valor_liquido ?? 0), 0) ?? 0;
  const totalEntrada = coletas?.reduce((s, c) => s + Number(c.entrada ?? c.valor_bruto ?? 0), 0) ?? 0;
  const totalSaida = coletas?.reduce((s, c) => s + Number(c.saida ?? 0), 0) ?? 0;
  const pontosAtivos = pontos?.filter((p) => p.status === "ativo").length ?? 0;
  const brindesEstoque = estoque?.reduce((s, e) => s + e.quantidade, 0) ?? 0;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pontosSemColeta =
    pontos?.filter((p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo).length ??
    0;

  const rankingMap = new Map<string, number>();
  coletas?.forEach((c) => {
    if (c.ponto_id) {
      rankingMap.set(
        c.ponto_id,
        (rankingMap.get(c.ponto_id) ?? 0) + Number(c.valor_bruto ?? c.entrada ?? 0)
      );
    }
  });

  const ranking = [...rankingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pontoId, valor]) => ({
      ponto: pontos?.find((p) => p.id === pontoId),
      valor,
    }))
    .filter((r): r is { ponto: DashboardRankingPoint; valor: number } => Boolean(r.ponto));

  const sparkline = sparklineFromDailyValues(
    (coletas ?? []).map((c) => ({
      created_at: c.created_at,
      value: Number(c.valor_bruto ?? c.entrada ?? 0),
    }))
  );

  const stats: Record<string, number> = {
    total_mes: totalBruto,
    lucro_estimado: totalLiquido,
    pontos_ativos: pontosAtivos,
    pontos_pendentes: pontosSemColeta,
    coletas_realizadas: coletas?.length ?? 0,
    brindes_estoque: brindesEstoque,
    entrada_total: totalEntrada,
    saida_total: totalSaida,
    saldo_liquido: totalEntrada - totalSaida,
    maquinas_ativas: pontosAtivos,
    clientes_ativos: pontosAtivos,
    pendencias: pendenciasCount ?? 0,
    receita_mes: totalBruto,
    visitas: coletas?.length ?? 0,
    tarefas_abertas: pendenciasCount ?? 0,
  };

  const pulso: PulsoOperacao = computePulsoOperacao(coletasToPulsoEventos(coletasPulso ?? []));
  const cartela: CartelaPontos = await fetchCartelaPontos(supabase, empresaId);

  return { stats, ranking, pontosSemColeta, sparkline, pulso, cartela };
}

function buildKpis(config: NichoConfig, stats: Record<string, number>): DashboardKpi[] {
  return config.dashboard.stats
    .filter((s) => !HERO_STAT_KEYS.has(s.key))
    .slice(0, 4)
    .map((s) => ({
      label: s.label,
      value: stats[s.key] ?? 0,
      warning: WARNING_KPI_KEYS.has(s.key),
      isCurrency: CURRENCY_KPI_KEYS.has(s.key),
    }));
}

function mergeQuickActions(configs: NichoConfig[]): DashboardQuickAction[] {
  const seen = new Set<string>();
  const out: DashboardQuickAction[] = [];
  for (const c of configs) {
    for (const a of c.dashboard.quickActions) {
      if (seen.has(a.href)) continue;
      seen.add(a.href);
      out.push({ label: a.label, href: a.href, icon: a.icon });
    }
  }
  return out.slice(0, 5);
}

/** Um único ranking por lucro do mês — melhores e piores não se contradizem. */
function triagePorLucro(
  pontos: { pontoId: string; nome: string; lucroMes: number; visitas?: number }[]
): {
  melhores: DashboardRankItem[];
  piores: DashboardRankItem[];
} {
  const comMovimento = pontos.filter(
    (p) => (p.visitas ?? 0) > 0 || Math.abs(p.lucroMes) > 0.009
  );
  const porLucroDesc = [...comMovimento].sort((a, b) => b.lucroMes - a.lucroMes);
  const porLucroAsc = [...comMovimento].sort((a, b) => a.lucroMes - b.lucroMes);

  const melhores = porLucroDesc
    .filter((p) => p.lucroMes > 0.009)
    .slice(0, 5)
    .map((p) => ({ pontoId: p.pontoId, nome: p.nome, valor: p.lucroMes }));

  const negativos = porLucroAsc
    .filter((p) => p.lucroMes < -0.009)
    .slice(0, 5)
    .map((p) => ({ pontoId: p.pontoId, nome: p.nome, valor: p.lucroMes }));

  if (negativos.length > 0) {
    return { melhores, piores: negativos };
  }

  // Sem prejuízo: menor rendimento = cauda baixa, sem repetir os melhores
  const idsMelhores = new Set(melhores.map((m) => m.pontoId));
  const cauda = porLucroAsc
    .filter((p) => !idsMelhores.has(p.pontoId))
    .slice(0, 5)
    .map((p) => ({ pontoId: p.pontoId, nome: p.nome, valor: p.lucroMes }));

  const piores =
    cauda.length > 0
      ? cauda
      : porLucroAsc
          .filter((p) => p.lucroMes <= 0.009)
          .slice(0, 5)
          .map((p) => ({ pontoId: p.pontoId, nome: p.nome, valor: p.lucroMes }));

  return { melhores, piores };
}

function mergeSaude(slices: DashSlice[]): SaudePontosResumo {
  const map = new Map<string, (typeof slices)[0]["saude"]["mes"][0]>();
  for (const s of slices) {
    for (const p of s.saude.mes) {
      const prev = map.get(p.pontoId);
      if (!prev) {
        map.set(p.pontoId, { ...p });
      } else {
        // Soma só movimento real — evita inflar com linhas "sem_dados" de outros nichos.
        if ((p.visitas ?? 0) > 0 || Math.abs(p.lucroMes) > 0.009) {
          prev.lucroMes += p.lucroMes;
          prev.impulsos += p.impulsos;
          prev.pressoes += p.pressoes;
          prev.visitas += p.visitas;
        }
      }
    }
  }
  const mes = aplicarClassificacaoSaudePorLucro([...map.values()]);
  const contagem = { forte: 0, razoavel: 0, fraco: 0, semDados: 0 };
  for (const p of mes) {
    if (p.classe === "forte") contagem.forte++;
    else if (p.classe === "razoavel") contagem.razoavel++;
    else if (p.classe === "fraco") contagem.fraco++;
    else contagem.semDados++;
  }
  return { mes, semana: [], contagem };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { periodo: periodoRaw, de, ate } = await searchParams;
  const periodoRange = resolverPeriodoAnalise({ periodo: periodoRaw, de, ate });
  const periodoFiltro: DashboardPeriodoFiltro = {
    inicioISO: periodoRange.inicioISO,
    fimISO: periodoRange.fimISO,
  };
  const periodLabel = periodoRange.label;

  const { profile, supabase, empresa } = await getAppBootstrap();
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const pesquisaUpgradeInsight = insightUpgradePesquisa(
    parsePesquisaOnboarding(empresa?.pesquisa_onboarding),
    nichosAtivos,
    empresa?.quantidade_pontos
  );
  const pesquisaUpgrade = pesquisaUpgradeInsight
    ? {
        mensagem: pesquisaUpgradeInsight.mensagem,
        href: pesquisaUpgradeInsight.href,
        proximoPlanoNome: pesquisaUpgradeInsight.proximoPlanoNome,
        nichosBloqueados: pesquisaUpgradeInsight.labelsBloqueados,
      }
    : null;
  const dashboardNichos = getDashboardNichosAtivos(nichosAtivos);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isUrsinho = nichosAtivos.includes("ursinho");
  const isDiversao = nichosAtivos.includes("diversao");
  const isBolinha = nichosAtivos.includes("bolinha");
  const isConsignado = nichosAtivos.includes("consignado");
  const isMultiNicho = isDashboardMultiNicho(nichosAtivos);
  const nicho = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nicho);
  const configCassino = getNichoConfig("maquinas_cassino");
  const configFura = getNichoConfig("fura_fura");
  const configUrsinho = getNichoConfig("ursinho");
  const configDiversao = getNichoConfig("diversao");
  const configBolinha = getNichoConfig("bolinha");
  const configConsignado = getNichoConfig("consignado");

  const emptyPulso = computePulsoOperacao([]);
  const emptyCartela = computeCartelaPontos([], []);
  const emptySaude = computeSaudePontos([]);

  const empty = {
    stats: {} as Record<string, number>,
    ranking: [] as { ponto: DashboardRankingPoint; valor: number }[],
    pontosSemColeta: 0,
    sparkline: [] as number[],
    pulso: emptyPulso,
    cartela: emptyCartela,
    saude: emptySaude,
  };

  let dashResult = empty;
  let saudeFinal = emptySaude;
  let comparativoMes:
    | { mesAtual: { lucroReal: number; coletas: number }; mesAnterior: { lucroReal: number; coletas: number } }
    | undefined;
  let multiSlices: Partial<Record<DashboardNichoId, DashSlice>> | null = null;
  let consolidado = null as Awaited<ReturnType<typeof getDashboardConsolidado>> | null;
  let chamadosAbertos = 0;
  let singleConfig = config;

  if (profile?.empresa_id) {
    if (isMultiNicho) {
      const [
        chamadosResumo,
        dashCassino,
        dashFura,
        dashUrsinho,
        dashDiversao,
        dashBolinha,
        dashConsignado,
      ] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        isCassino
          ? getCassinoDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
        isFuraFura
          ? getFuraFuraDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
        isUrsinho
          ? getUrsinhoDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
        isDiversao
          ? getDiversaoDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
        isBolinha
          ? getBolinhaDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
        isConsignado
          ? getConsignadoDashboardStats(supabase, profile.empresa_id, periodoFiltro)
          : Promise.resolve(null),
      ]);
      chamadosAbertos = chamadosResumo.total;

      consolidado = await getDashboardConsolidado(supabase, profile.empresa_id, {
        cassinoStats: dashCassino?.stats,
        furaStats: dashFura?.stats,
        ursinhoStats: dashUrsinho?.stats,
        diversaoStats: dashDiversao?.stats,
        bolinhaStats: dashBolinha?.stats,
        consignadoStats: dashConsignado?.stats,
        cassinoSparkline: dashCassino?.sparkline,
        furaSparkline: dashFura?.sparkline,
        ursinhoSparkline: dashUrsinho?.sparkline,
        diversaoSparkline: dashDiversao?.sparkline,
        bolinhaSparkline: dashBolinha?.sparkline,
        consignadoSparkline: dashConsignado?.sparkline,
      });

      const slices: Partial<Record<DashboardNichoId, DashSlice>> = {};
      if (dashCassino) {
        slices.maquinas_cassino = {
          stats: dashCassino.stats,
          ranking: dashCassino.ranking,
          pontosSemColeta: dashCassino.pontosSemColeta,
          sparkline: dashCassino.sparkline,
          pulso: dashCassino.pulso,
          cartela: dashCassino.cartela,
          saude: dashCassino.saude,
          config: configCassino,
          periodLabel,
        };
      }
      if (dashFura) {
        slices.fura_fura = {
          stats: dashFura.stats,
          ranking: dashFura.ranking,
          pontosSemColeta: dashFura.pontosSemColeta,
          sparkline: dashFura.sparkline,
          pulso: dashFura.pulso,
          cartela: dashFura.cartela,
          saude: dashFura.saude,
          config: configFura,
          periodLabel,
          comparativo: dashFura.comparativo,
        };
      }
      if (dashUrsinho) {
        slices.ursinho = {
          stats: dashUrsinho.stats,
          ranking: dashUrsinho.ranking,
          pontosSemColeta: dashUrsinho.pontosSemColeta,
          sparkline: dashUrsinho.sparkline,
          pulso: dashUrsinho.pulso,
          cartela: dashUrsinho.cartela,
          saude: dashUrsinho.saude,
          config: configUrsinho,
          periodLabel,
          comparativo: dashUrsinho.comparativo,
        };
      }
      if (dashDiversao) {
        slices.diversao = {
          stats: dashDiversao.stats,
          ranking: dashDiversao.ranking,
          pontosSemColeta: dashDiversao.pontosSemColeta,
          sparkline: dashDiversao.sparkline,
          pulso: dashDiversao.pulso,
          cartela: dashDiversao.cartela,
          saude: dashDiversao.saude,
          config: configDiversao,
          periodLabel,
          comparativo: dashDiversao.comparativo,
        };
      }
      if (dashBolinha) {
        slices.bolinha = {
          stats: dashBolinha.stats,
          ranking: dashBolinha.ranking,
          pontosSemColeta: dashBolinha.pontosSemColeta,
          sparkline: dashBolinha.sparkline,
          pulso: dashBolinha.pulso,
          cartela: dashBolinha.cartela,
          saude: dashBolinha.saude,
          config: configBolinha,
          periodLabel,
          comparativo: dashBolinha.comparativo,
        };
      }
      if (dashConsignado) {
        slices.consignado = {
          stats: dashConsignado.stats,
          ranking: dashConsignado.ranking,
          pontosSemColeta: dashConsignado.pontosSemColeta,
          sparkline: dashConsignado.sparkline,
          pulso: dashConsignado.pulso,
          cartela: dashConsignado.cartela,
          saude: dashConsignado.saude,
          config: configConsignado,
          periodLabel,
          comparativo: dashConsignado.comparativo,
        };
      }
      multiSlices = slices;
    } else if (isCassino) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getCassinoDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      singleConfig = configCassino;
    } else if (isFuraFura) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getFuraFuraDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoMes = dash.comparativo;
      singleConfig = configFura;
    } else if (isUrsinho) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getUrsinhoDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoMes = dash.comparativo;
      singleConfig = configUrsinho;
    } else if (isDiversao) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getDiversaoDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoMes = dash.comparativo;
      singleConfig = configDiversao;
    } else if (isBolinha) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getBolinhaDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoMes = dash.comparativo;
      singleConfig = configBolinha;
    } else if (isConsignado) {
      const [chamadosResumo, dash] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getConsignadoDashboardStats(supabase, profile.empresa_id, periodoFiltro),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoMes = dash.comparativo;
      singleConfig = configConsignado;
    } else {
      const [chamadosResumo, dash, saudeFetched] = await Promise.all([
        fetchChamadosAbertosResumo(profile.empresa_id),
        getDashboardStats(profile.empresa_id, nicho, periodoFiltro),
        fetchSaudePontos(supabase, profile.empresa_id, "generico"),
      ]);
      chamadosAbertos = chamadosResumo.total;
      dashResult = { ...dash, saude: saudeFetched };
      saudeFinal = saudeFetched;
    }
  }

  const nichoLabelHeader = isMultiNicho
    ? dashboardNichosLabel(dashboardNichos)
    : singleConfig.label;

  let comissaoStaff: DashboardPremiumData["comissaoStaff"] = null;
  if (profile?.empresa_id) {
    const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
    const raw = await fetchComissaoStaffPeriodo(
      supabase,
      profile.empresa_id,
      periodoFiltro.inicioISO,
      periodoFiltro.fimISO
    );
    const visivel = filtrarComissaoStaffParaViewer(raw, {
      userId: profile.user_id,
      isOwner: acesso.isOwner,
      role: acesso.role,
    });
    if (visivel.linhas.length > 0) {
      comissaoStaff = {
        total: visivel.total,
        totalVales: visivel.totalVales,
        totalAPagar: visivel.totalAPagar,
        propria:
          visivel.linhas.length === 1 &&
          visivel.linhas[0].userId === String(profile.user_id).toLowerCase(),
        linhas: visivel.linhas.map((l) => ({
          nome: l.nome,
          percentual: l.percentual,
          valor: l.valor,
          vales: l.vales,
          aPagar: l.aPagar,
        })),
      };
    }
  }

  let premium: DashboardPremiumData;

  if (isMultiNicho && multiSlices && consolidado) {
    const sliceList = dashboardNichos
      .map((id) => multiSlices![id])
      .filter((s): s is DashSlice => Boolean(s));
    const lucroTotal = consolidado.total.liquidoOperacao;
    const nichosLinhas: DashboardNichoLinha[] = dashboardNichos
      .map((id) => {
        const linha = consolidado!.linhas[id];
        if (!linha) return null;
        return {
          id,
          label: multiSlices![id]?.config.label ?? id,
          entrada: linha.entrada,
          saida: linha.saida,
          liquidoMovimento: linha.liquidoMovimento,
          liquidoOperacao: linha.liquidoOperacao,
          lucro: linha.liquidoOperacao,
          bruto: linha.entrada,
          aReceber: linha.aReceber,
          haver: linha.haver,
          movimentos: linha.movimentos,
          shareLucroPct:
            Math.abs(lucroTotal) > 0.009
              ? round2((linha.liquidoOperacao / lucroTotal) * 100)
              : null,
        };
      })
      .filter((n): n is DashboardNichoLinha => Boolean(n))
      .sort((a, b) => b.liquidoOperacao - a.liquidoOperacao);

    const saudeMerged = mergeSaude(sliceList);
    const { melhores, piores } = triagePorLucro(saudeMerged.mes);
    const pontosSemColeta = Math.max(0, ...sliceList.map((s) => s.pontosSemColeta), 0);
    const pulso = sliceList[0]?.pulso ?? emptyPulso;
    const cartela = sliceList[0]?.cartela ?? emptyCartela;
    const configs = sliceList.map((s) => s.config);

    premium = {
      greeting: dashboardGreeting(profile?.nome),
      operacaoNome: empresa?.nome_operacao ?? "Dashboard",
      periodLabel,
      nichoLabel: nichoLabelHeader,
      movimentosLabel:
        consolidado.total.movimentos > 0
          ? `${consolidado.total.movimentos} ${consolidado.total.movimentos === 1 ? "movimentação" : "movimentações"} · ${periodLabel}`
          : null,
      isMulti: true,
      lucro: consolidado.total.liquidoOperacao,
      entrada: consolidado.total.entrada,
      saida: consolidado.total.saida,
      liquidoMovimento: consolidado.total.liquidoMovimento,
      liquidoOperacao: consolidado.total.liquidoOperacao,
      bruto: consolidado.total.entrada,
      aReceber: consolidado.total.aReceber,
      haver: consolidado.total.haver,
      margemPct:
        consolidado.total.entrada > 0
          ? round2((consolidado.total.liquidoOperacao / consolidado.total.entrada) * 100)
          : null,
      sparkline: consolidado.sparkline,
      chamadosAbertos,
      pontosSemColeta,
      kpis: [
        { label: "Movimentos", value: consolidado.total.movimentos },
        { label: "Nichos ativos", value: nichosLinhas.length },
        {
          label: "Pontos sem coleta",
          value: pontosSemColeta,
          warning: pontosSemColeta > 0,
        },
        {
          label: "Chamados",
          value: chamadosAbertos,
          warning: chamadosAbertos > 0,
        },
      ],
      nichos: nichosLinhas,
      melhores,
      piores,
      saude: saudeMerged,
      pulso,
      cartela,
      quickActions: mergeQuickActions(configs),
      comparativo: null,
      consolidado,
      comissaoStaff,
      pesquisaUpgrade,
    };
  } else {
    const { stats, pontosSemColeta, sparkline, pulso, cartela } = dashResult;
    const aReceber = stats.a_receber_pendente ?? 0;
    const haver = stats.haver_ponto ?? 0;
    const coletasMes = stats.coletas_realizadas ?? stats.visitas ?? 0;
    const { melhores, piores } = triagePorLucro(saudeFinal.mes);

    // Entrada/saída = movimento das máquinas.
    // Lucro líquido (dashboard) = resultado da operação (regra Fura), mesmo sem pagamento.
    const entrada = round2(Number(stats.entrada_total ?? stats.total_mes ?? stats.receita_mes ?? 0));
    const saida = round2(Number(stats.saida_total ?? 0));
    const liquidoMovimento = round2(
      Number(stats.saldo_liquido ?? stats.total_mes ?? entrada - saida)
    );
    const liquidoOperacao = round2(
      Number(stats.lucro_estimado ?? stats.receita_mes ?? liquidoMovimento)
    );

    premium = {
      greeting: dashboardGreeting(profile?.nome),
      operacaoNome: empresa?.nome_operacao ?? "Dashboard",
      periodLabel,
      nichoLabel: nichoLabelHeader,
      movimentosLabel:
        coletasMes > 0
          ? `${coletasMes} ${coletasMes === 1 ? "coleta" : "coletas"} este mês`
          : null,
      isMulti: false,
      lucro: liquidoOperacao,
      entrada,
      saida,
      liquidoMovimento,
      liquidoOperacao,
      bruto: entrada,
      aReceber,
      haver,
      margemPct: entrada > 0 ? round2((liquidoOperacao / entrada) * 100) : null,
      sparkline,
      chamadosAbertos,
      pontosSemColeta,
      kpis: buildKpis(singleConfig, stats),
      nichos: [],
      melhores,
      piores,
      saude: saudeFinal,
      pulso,
      cartela,
      quickActions: mergeQuickActions([singleConfig]),
      comparativo: comparativoMes
        ? {
            lucroAtual: comparativoMes.mesAtual.lucroReal,
            lucroAnterior: comparativoMes.mesAnterior.lucroReal,
            coletasAtual: comparativoMes.mesAtual.coletas,
            coletasAnterior: comparativoMes.mesAnterior.coletas,
          }
        : null,
      consolidado: null,
      comissaoStaff,
      pesquisaUpgrade,
    };
  }

  return (
    <DashboardPremiumClient
      data={premium}
      periodo={periodoRange}
      trialResumo={resumoTrialPorFaixa(
        empresa?.quantidade_pontos,
        (empresa?.pesquisa_onboarding?.nichos_interesse as never) ?? []
      )}
    />
  );
}
