import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";
import {
  fetchPendenciasAbertas,
  somarPendenciasPorNicho,
  type PendenciasPorNicho,
} from "@/lib/dashboard-pendencias-abertas";

export type NichoConsolidadoLinha = {
  /** Quanto as máquinas faturaram (entrada). */
  entrada: number;
  /** Quanto saiu das máquinas. */
  saida: number;
  /** @deprecated use entrada */
  bruto: number;
  /** Resultado do movimento (entrada − saída). */
  liquidoMovimento: number;
  /** Resultado da operação no dashboard (accrual — conta mesmo sem pagamento). */
  liquidoOperacao: number;
  /** @deprecated use liquidoOperacao */
  lucro: number;
  aReceber: number;
  haver: number;
  movimentos: number;
};

export type DashboardConsolidadoData = {
  linhas: Partial<Record<DashboardNichoId, NichoConsolidadoLinha>>;
  total: NichoConsolidadoLinha;
  sparkline: number[];
  /** @deprecated use linhas.maquinas_cassino */
  cassino: NichoConsolidadoLinha;
  /** @deprecated use linhas.fura_fura */
  furaFura: NichoConsolidadoLinha;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyLinha(): NichoConsolidadoLinha {
  return {
    entrada: 0,
    saida: 0,
    bruto: 0,
    liquidoMovimento: 0,
    liquidoOperacao: 0,
    lucro: 0,
    aReceber: 0,
    haver: 0,
    movimentos: 0,
  };
}

function sumLinhas(a: NichoConsolidadoLinha, b: NichoConsolidadoLinha): NichoConsolidadoLinha {
  return {
    entrada: round2(a.entrada + b.entrada),
    saida: round2(a.saida + b.saida),
    bruto: round2(a.bruto + b.bruto),
    liquidoMovimento: round2(a.liquidoMovimento + b.liquidoMovimento),
    liquidoOperacao: round2(a.liquidoOperacao + b.liquidoOperacao),
    lucro: round2(a.lucro + b.lucro),
    aReceber: round2(a.aReceber + b.aReceber),
    haver: round2(a.haver + b.haver),
    movimentos: a.movimentos + b.movimentos,
  };
}

function mergeSparklines(...series: number[][]): number[] {
  const len = Math.max(7, ...series.map((s) => s.length));
  return Array.from({ length: len }, (_, i) =>
    series.reduce((sum, s) => sum + (s[i] ?? 0), 0)
  );
}

function linhaFromMovimento(
  stats: Record<string, number>,
  opts: {
    liquidoOperacao: number;
    aReceber?: number;
    haver?: number;
  }
): NichoConsolidadoLinha {
  const entrada = round2(
    stats.entrada_total ?? stats.total_mes ?? stats.receita_mes ?? 0
  );
  const saida = round2(stats.saida_total ?? 0);
  const liquidoMovimento = round2(
    stats.saldo_liquido ?? stats.total_mes ?? stats.lucro_estimado ?? entrada - saida
  );
  const liquidoOperacao = round2(opts.liquidoOperacao);
  return {
    entrada,
    saida,
    bruto: entrada,
    liquidoMovimento,
    liquidoOperacao,
    lucro: liquidoOperacao,
    aReceber: round2(opts.aReceber ?? 0),
    haver: round2(opts.haver ?? 0),
    movimentos: stats.coletas_realizadas ?? stats.visitas ?? 0,
  };
}

function linhaFromCassinoStats(
  stats: Record<string, number>,
  pendencias: { cassinoPendente: number; cassinoHaver: number }
): NichoConsolidadoLinha {
  // Dashboard = regra Fura: lucro da operação (accrual), não só o pago.
  const liquidoOperacao = round2(
    stats.lucro_estimado ?? stats.operacao_gerada_mes ?? stats.total_mes ?? 0
  );
  return linhaFromMovimento(stats, {
    liquidoOperacao,
    // Preferir cobravel das visitas (já em a_receber_pendente) — pendências espelhadas mentem.
    aReceber: stats.a_receber_pendente ?? pendencias.cassinoPendente,
    haver: pendencias.cassinoHaver,
  });
}

function linhaFromFuraStats(
  stats: Record<string, number>,
  pendencias: { furaHaver: number; furaPendente?: number }
): NichoConsolidadoLinha {
  const liquidoOperacao = round2(stats.lucro_estimado ?? 0);
  return linhaFromMovimento(stats, {
    liquidoOperacao,
    aReceber: Math.max(stats.a_receber_pendente ?? 0, pendencias.furaPendente ?? 0),
    haver: pendencias.furaHaver,
  });
}

function linhaFromUrsinhoStats(
  stats: Record<string, number>,
  pendencias?: { ursinhoPendente?: number; ursinhoHaver?: number }
): NichoConsolidadoLinha {
  return linhaFromMovimento(stats, {
    liquidoOperacao: round2(stats.lucro_estimado ?? stats.saldo_liquido ?? 0),
    aReceber: stats.a_receber_pendente ?? pendencias?.ursinhoPendente ?? 0,
    haver: pendencias?.ursinhoHaver ?? 0,
  });
}

function linhaFromDiversaoStats(
  stats: Record<string, number>,
  pendencias?: { diversaoPendente?: number; diversaoHaver?: number }
): NichoConsolidadoLinha {
  return linhaFromMovimento(stats, {
    liquidoOperacao: round2(stats.lucro_estimado ?? stats.saldo_liquido ?? 0),
    aReceber: stats.a_receber_pendente ?? pendencias?.diversaoPendente ?? 0,
    haver: pendencias?.diversaoHaver ?? 0,
  });
}

function linhaFromBolinhaStats(
  stats: Record<string, number>,
  pendencias?: { bolinhaPendente?: number; bolinhaHaver?: number }
): NichoConsolidadoLinha {
  return linhaFromMovimento(stats, {
    liquidoOperacao: round2(stats.lucro_estimado ?? stats.saldo_liquido ?? 0),
    aReceber: stats.a_receber_pendente ?? pendencias?.bolinhaPendente ?? 0,
    haver: pendencias?.bolinhaHaver ?? 0,
  });
}

function linhaFromConsignadoStats(
  stats: Record<string, number>,
  pendencias?: { consignadoPendente?: number; consignadoHaver?: number }
): NichoConsolidadoLinha {
  return linhaFromMovimento(stats, {
    liquidoOperacao: round2(stats.lucro_estimado ?? stats.saldo_liquido ?? 0),
    aReceber: stats.a_receber_pendente ?? pendencias?.consignadoPendente ?? 0,
    haver: pendencias?.consignadoHaver ?? 0,
  });
}

export function buildConsolidadoFromStats(input: {
  cassinoStats?: Record<string, number>;
  furaStats?: Record<string, number>;
  ursinhoStats?: Record<string, number>;
  diversaoStats?: Record<string, number>;
  bolinhaStats?: Record<string, number>;
  consignadoStats?: Record<string, number>;
  cassinoSparkline?: number[];
  furaSparkline?: number[];
  ursinhoSparkline?: number[];
  diversaoSparkline?: number[];
  bolinhaSparkline?: number[];
  consignadoSparkline?: number[];
  pendencias: PendenciasPorNicho;
}): DashboardConsolidadoData {
  const linhas: Partial<Record<DashboardNichoId, NichoConsolidadoLinha>> = {};

  if (input.cassinoStats) {
    linhas.maquinas_cassino = linhaFromCassinoStats(input.cassinoStats, input.pendencias);
  }
  if (input.furaStats) {
    linhas.fura_fura = linhaFromFuraStats(input.furaStats, input.pendencias);
  }
  if (input.ursinhoStats) {
    linhas.ursinho = linhaFromUrsinhoStats(input.ursinhoStats, input.pendencias);
  }
  if (input.diversaoStats) {
    linhas.diversao = linhaFromDiversaoStats(input.diversaoStats, input.pendencias);
  }
  if (input.bolinhaStats) {
    linhas.bolinha = linhaFromBolinhaStats(input.bolinhaStats, input.pendencias);
  }
  if (input.consignadoStats) {
    linhas.consignado = linhaFromConsignadoStats(input.consignadoStats, input.pendencias);
  }

  const ordered = [
    linhas.maquinas_cassino,
    linhas.fura_fura,
    linhas.ursinho,
    linhas.diversao,
    linhas.bolinha,
    linhas.consignado,
  ].filter((l): l is NichoConsolidadoLinha => Boolean(l));

  const total = ordered.reduce(
    (acc, linha) => sumLinhas(acc, linha),
    emptyLinha()
  );
  // Dívida universal (visita ao ponto) entra no total, sem ratear por nicho.
  total.aReceber = round2(total.aReceber + (input.pendencias.pontoPendente ?? 0));

  return {
    linhas,
    cassino: linhas.maquinas_cassino ?? emptyLinha(),
    furaFura: linhas.fura_fura ?? emptyLinha(),
    total,
    sparkline: mergeSparklines(
      input.cassinoSparkline ?? [],
      input.furaSparkline ?? [],
      input.ursinhoSparkline ?? [],
      input.diversaoSparkline ?? [],
      input.bolinhaSparkline ?? [],
      input.consignadoSparkline ?? []
    ),
  };
}

export async function getDashboardConsolidado(
  supabase: SupabaseClient,
  empresaId: string,
  input: {
    cassinoStats?: Record<string, number>;
    furaStats?: Record<string, number>;
    ursinhoStats?: Record<string, number>;
    diversaoStats?: Record<string, number>;
    bolinhaStats?: Record<string, number>;
    consignadoStats?: Record<string, number>;
    cassinoSparkline?: number[];
    furaSparkline?: number[];
    ursinhoSparkline?: number[];
    diversaoSparkline?: number[];
    bolinhaSparkline?: number[];
    consignadoSparkline?: number[];
  }
): Promise<DashboardConsolidadoData> {
  const pendenciasRows = await fetchPendenciasAbertas(supabase, empresaId);
  const pendencias = somarPendenciasPorNicho(pendenciasRows);
  return buildConsolidadoFromStats({ ...input, pendencias });
}
