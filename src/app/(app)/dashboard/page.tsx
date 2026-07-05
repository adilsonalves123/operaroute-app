import { getNichoConfig } from "@/lib/nicho";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getCassinoDashboardStats } from "@/lib/nichos/cassino/dashboard-stats";
import { getFuraFuraDashboardStats } from "@/lib/nichos/fura-fura/dashboard-stats";
import { dashboardGreeting, monthPeriodLabel } from "@/lib/dashboard-greeting";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardKpiStrip, type KpiItem } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardCommandBar } from "@/components/dashboard/DashboardCommandBar";
import { DashboardAlertStrip } from "@/components/dashboard/DashboardAlertStrip";
import { DashboardRanking } from "@/components/dashboard/DashboardRanking";
import { DashboardPulso } from "@/components/dashboard/DashboardPulso";
import { DashboardCartelaPontos } from "@/components/dashboard/DashboardCartelaPontos";
import { DashboardSaudeResumo } from "@/components/dashboard/DashboardSaudeResumo";
import { DashboardComparativoMes } from "@/components/dashboard/DashboardComparativoMes";
import { DashboardMultiNichoTabs } from "@/components/dashboard/DashboardMultiNichoTabs";import {
  computePulsoOperacao,
  type PulsoEvento,
  type PulsoOperacao,
} from "@/lib/dashboard-pulso";
import {
  computeCartelaPontos,
  fetchCartelaPontos,
  type CartelaPontos,
} from "@/lib/dashboard-cartela-pontos";
import { computeSaudePontos, fetchSaudePontos, type SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import type { Nicho, Ponto } from "@/lib/types/database";

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
]);

const WARNING_KPI_KEYS = new Set(["pendencias", "pontos_pendentes", "tarefas_abertas"]);

function sparklineFromDailyValues(
  rows: { created_at: string; value: number }[]
): number[] {
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

async function getDashboardStats(empresaId: string, _nicho: Nicho) {
  const supabase = await createClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: coletas },
    { data: coletasPulso },
    { data: pontos },
    { count: pendenciasCount },
    { data: estoque },
  ] = await Promise.all([
    supabase
      .from("coletas")
      .select("valor_bruto, valor_liquido, entrada, saida, ponto_id, created_at")
      .eq("empresa_id", empresaId)
      .gte("created_at", startOfMonth),
    supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_centavos, valor_liquido, valor_bruto, entrada"
      )
      .eq("empresa_id", empresaId)
      .gte("created_at", thirtyFiveDaysAgo),
    supabase
      .from("pontos")
      .select("*")
      .eq("empresa_id", empresaId),
    supabase
      .from("pendencias")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "aberta"),
    supabase
      .from("estoque")
      .select("quantidade")
      .eq("empresa_id", empresaId),
  ]);

  const totalBruto = coletas?.reduce((s, c) => s + Number(c.valor_bruto ?? c.entrada ?? 0), 0) ?? 0;
  const totalLiquido = coletas?.reduce((s, c) => s + Number(c.valor_liquido ?? 0), 0) ?? 0;
  const totalEntrada = coletas?.reduce((s, c) => s + Number(c.entrada ?? c.valor_bruto ?? 0), 0) ?? 0;
  const totalSaida = coletas?.reduce((s, c) => s + Number(c.saida ?? 0), 0) ?? 0;
  const pontosAtivos = pontos?.filter((p) => p.status === "ativo").length ?? 0;
  const brindesEstoque = estoque?.reduce((s, e) => s + e.quantidade, 0) ?? 0;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pontosSemColeta = pontos?.filter(
    (p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo
  ).length ?? 0;

  const rankingMap = new Map<string, number>();
  coletas?.forEach((c) => {
    if (c.ponto_id) {
      rankingMap.set(c.ponto_id, (rankingMap.get(c.ponto_id) ?? 0) + Number(c.valor_bruto ?? c.entrada ?? 0));
    }
  });

  const ranking = [...rankingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pontoId, valor]) => ({
      ponto: pontos?.find((p) => p.id === pontoId),
      valor,
    }))
    .filter((r): r is { ponto: Ponto; valor: number } => Boolean(r.ponto));

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

  const pulso: PulsoOperacao = computePulsoOperacao(
    coletasToPulsoEventos(coletasPulso ?? [])
  );

  const cartela: CartelaPontos = await fetchCartelaPontos(supabase, empresaId);

  return { stats, ranking, pontosSemColeta, sparkline, pulso, cartela };
}

function buildKpiItems(
  statDefs: { key: string; label: string }[],
  stats: Record<string, number>
): KpiItem[] {
  return statDefs
    .filter((s) => !HERO_STAT_KEYS.has(s.key))
    .slice(0, 4)
    .map((s) => ({
      label: s.label,
      value: stats[s.key] ?? 0,
      highlight: WARNING_KPI_KEYS.has(s.key) ? "warning" : "default",
      isCurrency: false,
    }));
}

function resolveHeroSaldo(stats: Record<string, number>): number {
  if (stats.entrada_total !== undefined && stats.saida_total !== undefined) {
    return stats.saldo_liquido ?? stats.entrada_total - stats.saida_total;
  }
  return stats.saldo_liquido ?? stats.total_mes ?? stats.receita_mes ?? 0;
}

export default async function DashboardPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isMultiNicho = isCassino && isFuraFura;
  const nicho = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nicho);
  const configCassino = getNichoConfig("maquinas_cassino");
  const configFura = getNichoConfig("fura_fura");
  const supabase = await createClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const emptyPulso = computePulsoOperacao([]);
  const emptyCartela = computeCartelaPontos([], []);
  const emptySaude = computeSaudePontos([]);

  const empty = {
    stats: {} as Record<string, number>,
    ranking: [] as { ponto: Ponto; valor: number }[],
    pontosSemColeta: 0,
    sparkline: [] as number[],
    pulso: emptyPulso,
    cartela: emptyCartela,
    saude: emptySaude,
  };

  let dashResult = empty;
  let saudeFinal = emptySaude;
  let comparativoFura: { mesAtual: { lucroReal: number; coletas: number }; mesAnterior: { lucroReal: number; coletas: number } } | undefined;
  let multiCassino = null;
  let multiFura = null;

  if (profile?.empresa_id) {
    if (isMultiNicho) {
      const [dashCassino, dashFura, saudeCassino] = await Promise.all([
        getCassinoDashboardStats(supabase, profile.empresa_id, startOfMonth),
        getFuraFuraDashboardStats(supabase, profile.empresa_id, startOfMonth),
        fetchSaudePontos(supabase, profile.empresa_id, "cassino"),
      ]);
      multiCassino = {
        stats: dashCassino.stats,
        ranking: dashCassino.ranking as { ponto: Ponto; valor: number }[],
        pontosSemColeta: dashCassino.pontosSemColeta,
        sparkline: dashCassino.sparkline,
        pulso: dashCassino.pulso,
        cartela: dashCassino.cartela,
        saude: saudeCassino,
        config: configCassino,
        periodLabel: monthPeriodLabel(),
      };
      multiFura = {
        stats: dashFura.stats,
        ranking: dashFura.ranking,
        pontosSemColeta: dashFura.pontosSemColeta,
        sparkline: dashFura.sparkline,
        pulso: dashFura.pulso,
        cartela: dashFura.cartela,
        saude: dashFura.saude,
        config: configFura,
        periodLabel: monthPeriodLabel(),
        comparativo: dashFura.comparativo,
      };
    } else if (isCassino) {
      const [dash, saudeFetched] = await Promise.all([
        getCassinoDashboardStats(supabase, profile.empresa_id, startOfMonth),
        fetchSaudePontos(supabase, profile.empresa_id, "cassino"),
      ]);
      dashResult = { ...dash, saude: saudeFetched };
      saudeFinal = saudeFetched;
    } else if (isFuraFura) {
      const dash = await getFuraFuraDashboardStats(supabase, profile.empresa_id, startOfMonth);
      dashResult = dash;
      saudeFinal = dash.saude;
      comparativoFura = dash.comparativo;
    } else {      const [dash, saudeFetched] = await Promise.all([
        getDashboardStats(profile.empresa_id, nicho),
        fetchSaudePontos(supabase, profile.empresa_id, "generico"),
      ]);
      dashResult = { ...dash, saude: saudeFetched };
      saudeFinal = saudeFetched;
    }
  }

  const { stats, ranking, pontosSemColeta, sparkline, pulso, cartela } = dashResult;

  const hasEntradaSaida =
    (stats.entrada_total ?? 0) > 0 || (stats.saida_total ?? 0) > 0;
  const coletasMes = stats.coletas_realizadas ?? stats.visitas ?? 0;
  const nichoLabelHeader = isMultiNicho
    ? "Cassino · Fura Fura"
    : isFuraFura
      ? configFura.label
      : isCassino
        ? configCassino.label
        : config.label;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{dashboardGreeting(profile?.nome)}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {empresa?.nome_operacao ?? "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {nichoLabelHeader}
            {!isMultiNicho && coletasMes > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-slate-400">
                  {coletasMes} {coletasMes === 1 ? "coleta" : "coletas"} este mês
                </span>
              </>
            )}
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-600 shrink-0">
          {monthPeriodLabel()}
        </p>
      </header>

      {isMultiNicho && multiCassino && multiFura ? (
        <>
          <DashboardMultiNichoTabs cassino={multiCassino} furaFura={multiFura} />
          <DashboardCommandBar actions={configCassino.dashboard.quickActions} />
        </>
      ) : (
        <>
          <DashboardHero
            saldo={resolveHeroSaldo(stats)}
            entrada={hasEntradaSaida ? stats.entrada_total : undefined}
            saida={hasEntradaSaida ? stats.saida_total : undefined}
            periodLabel={monthPeriodLabel()}
            nichoLabel={isFuraFura ? configFura.label : config.label}
            sparkline={sparkline}
          />

          {comparativoFura && (
            <DashboardComparativoMes
              lucroAtual={comparativoFura.mesAtual.lucroReal}
              lucroAnterior={comparativoFura.mesAnterior.lucroReal}
              coletasAtual={comparativoFura.mesAtual.coletas}
              coletasAnterior={comparativoFura.mesAnterior.coletas}
            />
          )}

          <DashboardKpiStrip
            items={buildKpiItems(
              (isFuraFura ? configFura : config).dashboard.stats,
              stats
            )}
          />

          <DashboardSaudeResumo saude={saudeFinal} />

          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardPulso pulso={pulso} />
            <DashboardCartelaPontos cartela={cartela} />
          </div>

          <DashboardCommandBar
            actions={(isFuraFura ? configFura : config).dashboard.quickActions}
          />

          <DashboardAlertStrip pontosSemColeta={pontosSemColeta} />

          <DashboardRanking ranking={ranking} />
        </>
      )}
    </div>
  );
}