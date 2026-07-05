import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "./contadores";
import {
  computePulsoOperacao,
  type PulsoEvento,
  type PulsoOperacao,
} from "@/lib/dashboard-pulso";
import { fetchCartelaPontos, type CartelaPontos } from "@/lib/dashboard-cartela-pontos";

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
  startOfMonth: string
) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: visitas },
    { data: visitasPulso },
    { data: pontos },
    { count: pendenciasCount },
    { data: coletasMes },
  ] = await Promise.all([
    supabase
      .from("visitas")
      .select("id, ponto_id, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, valor_pago, saldo_negativo, created_at")
      .eq("empresa_id", empresaId)
      .gte("created_at", startOfMonth),
    supabase
      .from("visitas")
      .select("created_at, total_lucro_centavos, saldo_negativo")
      .eq("empresa_id", empresaId)
      .gte("created_at", thirtyFiveDaysAgo),
    supabase.from("pontos").select("*").eq("empresa_id", empresaId),
    supabase
      .from("pendencias")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "aberta"),
    supabase
      .from("coletas")
      .select("entrada_periodo, saida_periodo, ponto_id")
      .eq("empresa_id", empresaId)
      .gte("created_at", startOfMonth)
      .not("visita_id", "is", null),
  ]);

  const visitasList = visitas ?? [];
  const totalLucroReais = visitasList.reduce(
    (s, v) => s + centesimosToReais(Number(v.total_lucro_centavos ?? 0)),
    0
  );
  const totalOperacao = visitasList.reduce(
    (s, v) => s + Number(v.valor_operacao ?? 0),
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
        (rankingMap.get(v.ponto_id) ?? 0) + Number(v.valor_operacao ?? 0)
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
    .filter((r) => r.ponto);

  const sparkline = sparklineFromDailyValues(
    visitasList.map((v) => ({
      created_at: v.created_at,
      value: centesimosToReais(Math.abs(Number(v.total_lucro_centavos ?? 0))),
    }))
  );

  const saldoEntradaSaida = totalEntradaPeriodo - totalSaidaPeriodo;

  const pulso: PulsoOperacao = computePulsoOperacao(
    visitasToPulsoEventos(visitasPulso ?? [])
  );

  const cartela: CartelaPontos = await fetchCartelaPontos(supabase, empresaId);

  return {
    stats: {
      entrada_total: totalEntradaPeriodo,
      saida_total: totalSaidaPeriodo,
      saldo_liquido: saldoEntradaSaida,
      total_mes: totalLucroReais,
      lucro_estimado: totalOperacao,
      coletas_realizadas: visitasList.length,
      visitas: visitasList.length,
      maquinas_ativas: pontosAtivos,
      clientes_ativos: pontosAtivos,
      pontos_ativos: pontosAtivos,
      pontos_pendentes: pontosSemColeta,
      pendencias: pendenciasCount ?? 0,
      receita_mes: totalOperacao,
    },
    ranking,
    pontosSemColeta,
    sparkline,
    pulso,
    cartela,
  };
}
