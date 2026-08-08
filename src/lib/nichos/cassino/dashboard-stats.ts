import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "./contadores";
import {
  computePulsoOperacao,
  type PulsoEvento,
  type PulsoOperacao,
} from "@/lib/dashboard-pulso";
import type { DashboardRankingPoint } from "@/components/dashboard/DashboardRanking";
import { fetchCartelaPontos, type CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import { fetchDashboardPontosBase } from "@/lib/dashboard-pontos-base";
import { fetchPendenciasAbertas, somarPendenciasPorNicho } from "@/lib/dashboard-pendencias-abertas";
import {
  buildSaudeResumoFromEventos,
  visitasToEventosPonto,
  type SaudePontosResumo,
} from "@/lib/dashboard-saude-pontos";
import { liquidoRecebidoCassinoVisita, lucroOperacaoCassinoVisita } from "@/lib/nichos/cassino/lucro-recebido";
import type { DashboardPeriodoFiltro } from "@/lib/dashboard-periodo";

function isPendenciaOperacaoTipo(tipo: string | null | undefined): boolean {
  const t = (tipo ?? "").toLowerCase();
  return t === "pagamento_pendente" || t === "parcial";
}

function mapaPendenciaOperacaoAberta(
  rows: { visita_id: string | null; tipo: string | null; valor: number | null }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of rows) {
    if (!p.visita_id || !isPendenciaOperacaoTipo(p.tipo)) continue;
    map.set(p.visita_id, (map.get(p.visita_id) ?? 0) + Number(p.valor ?? 0));
  }
  return map;
}

export function visitasToPulsoEventos(
  visitas: {
    created_at: string;
    total_lucro_centavos: number | null;
    saldo_negativo: boolean | null;
  }[]
): PulsoEvento[] {
  return visitas.map((v) => {
    const lucroReais = centesimosToReais(Number(v.total_lucro_centavos ?? 0));
    return {
      created_at: v.created_at,
      lucroReais,
      negativa: Boolean(v.saldo_negativo) || lucroReais < -0.009,
    };
  });
}

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

export async function getCassinoDashboardStats(
  supabase: SupabaseClient,
  empresaId: string,
  periodo: DashboardPeriodoFiltro
) {
  const { inicioISO, fimISO } = periodo;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lookbackISO =
    inicioISO < new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString()
      ? inicioISO
      : new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: visitasRaw },
    pontos,
    pendenciasAbertas,
    { data: coletasMes },
  ] = await Promise.all([
    supabase
      .from("visitas")
      .select(
        "id, ponto_id, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, valor_pago, restante, saldo_negativo, desconto, adiantamento_pix, adiantamento_dinheiro, created_at, pontos(nome)"
      )
      .eq("empresa_id", empresaId)
      .gte("created_at", lookbackISO)
      .lte("created_at", fimISO),
    fetchDashboardPontosBase(supabase, empresaId),
    fetchPendenciasAbertas(supabase, empresaId),
    supabase
      .from("coletas")
      .select("entrada_periodo, saida_periodo, ponto_id")
      .eq("empresa_id", empresaId)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO)
      .not("visita_id", "is", null),
  ]);

  const visitasList = (visitasRaw ?? []).filter(
    (v) => v.created_at >= inicioISO && v.created_at <= fimISO
  );
  const visitasPulso = visitasRaw ?? [];
  const pendenciasCount = pendenciasAbertas.length;
  const openOpByVisita = mapaPendenciaOperacaoAberta(pendenciasAbertas);
  const totalLucroReais = visitasList.reduce(
    (s, v) => s + lucroOperacaoCassinoVisita(v),
    0
  );
  const totalOperacaoGerada = visitasList.reduce(
    (s, v) => s + Number(v.valor_operacao ?? 0),
    0
  );
  const totalOperacaoRecebida = visitasList.reduce(
    (s, v) =>
      s +
      liquidoRecebidoCassinoVisita(v, openOpByVisita.get(v.id) ?? 0),
    0
  );
  const totalEntradaPeriodo =
    coletasMes?.reduce((s, c) => s + centesimosToReais(Number(c.entrada_periodo ?? 0)), 0) ?? 0;
  const totalSaidaPeriodo =
    coletasMes?.reduce((s, c) => s + centesimosToReais(Number(c.saida_periodo ?? 0)), 0) ?? 0;

  const pontosAtivos = pontos?.filter((p) => p.status === "ativo").length ?? 0;
  const pontosSemColeta =
    pontos?.filter(
      (p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo
    ).length ?? 0;

  const rankingMap = new Map<string, number>();
  visitasList.forEach((v) => {
    if (v.ponto_id) {
      rankingMap.set(
        v.ponto_id,
        (rankingMap.get(v.ponto_id) ?? 0) + lucroOperacaoCassinoVisita(v)
      );
    }
  });

  const ranking = [...rankingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pontoId, valor]) => ({
      ponto: pontos?.find((p) => p.id === pontoId),
      valor,
    }))
    .filter((r): r is { ponto: DashboardRankingPoint; valor: number } => Boolean(r.ponto));

  const sparkline = sparklineFromDailyValues(
    visitasList.map((v) => ({
      created_at: v.created_at,
      value: Math.abs(lucroOperacaoCassinoVisita(v)),
    }))
  );

  const saldoEntradaSaida = totalEntradaPeriodo - totalSaidaPeriodo;
  const pendSums = somarPendenciasPorNicho(pendenciasAbertas);

  const pulso: PulsoOperacao = computePulsoOperacao(
    visitasToPulsoEventos(visitasPulso)
  );

  const cartela: CartelaPontos = await fetchCartelaPontos(supabase, empresaId);

  const saude: SaudePontosResumo = buildSaudeResumoFromEventos(
    visitasToEventosPonto(visitasPulso, { usarValorOperacao: true }),
    (pontos ?? []).filter((p) => p.status === "ativo").map((p) => ({ id: p.id, nome: p.nome }))
  );

  return {
    stats: {
      entrada_total: totalEntradaPeriodo,
      saida_total: totalSaidaPeriodo,
      saldo_liquido: saldoEntradaSaida,
      total_mes: totalLucroReais,
      // Lucro da operação (regra Fura): conta na coleta, mesmo sem pagamento.
      // receita_mes = só o que já foi pago (usado na Análise).
      lucro_estimado: totalLucroReais,
      coletas_realizadas: visitasList.length,
      visitas: visitasList.length,
      maquinas_ativas: pontosAtivos,
      clientes_ativos: pontosAtivos,
      pontos_ativos: pontosAtivos,
      pontos_pendentes: pontosSemColeta,
      pendencias: pendenciasCount ?? 0,
      a_receber_pendente: pendSums.cassinoPendente,
      haver_ponto: pendSums.cassinoHaver,
      receita_mes: totalOperacaoRecebida,
      operacao_gerada_mes: totalOperacaoGerada,
    },
    ranking,
    pontosSemColeta,
    sparkline,
    pulso,
    cartela,
    saude,
  };
}
