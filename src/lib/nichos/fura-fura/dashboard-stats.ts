import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCartelaPontos, type CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import { computePulsoOperacao, type PulsoOperacao } from "@/lib/dashboard-pulso";
import { fetchSaudePontos, type SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import { NICHO_MODULO_FURA_FURA, saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import type { ComparativoMes } from "@/lib/nichos/fura-fura/reconstruct-coleta";
import type { Ponto } from "@/lib/types/database";

function startOfPreviousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
}

function endOfPreviousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
}

function aggregateColetas(
  rows: {
    valor_bruto?: number | null;
    lucro_real?: number | null;
    valor_liquido?: number | null;
    quantidade_furos?: number | null;
  }[]
): ComparativoMes {
  return {
    totalBruto: rows.reduce((s, c) => s + Number(c.valor_bruto ?? 0), 0),
    lucroReal: rows.reduce(
      (s, c) => s + Number(c.lucro_real ?? c.valor_liquido ?? 0),
      0
    ),
    coletas: rows.length,
    furos: rows.reduce((s, c) => s + Number(c.quantidade_furos ?? 0), 0),
  };
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
    if (diffDays >= 0 && diffDays < 7) buckets[6 - diffDays] += row.value;
  }
  return buckets;
}

export async function getFuraFuraDashboardStats(
  supabase: SupabaseClient,
  empresaId: string,
  startOfMonth: string
) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: coletasMes },
    { data: coletasMesAnterior },
    { data: coletasPulso },
    { data: pontos },
    { count: pendenciasCount },
    { data: estoque },
    cartela,
    saude,
  ] = await Promise.all([
    supabase
      .from("coletas")
      .select(
        "valor_bruto, lucro_real, valor_liquido, quantidade_furos, ponto_id, created_at, valor_a_receber, valor_pago_recebido"
      )
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .gte("created_at", startOfMonth),
    supabase
      .from("coletas")
      .select("valor_bruto, lucro_real, valor_liquido, quantidade_furos")
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .gte("created_at", startOfPreviousMonth())
      .lte("created_at", endOfPreviousMonth()),
    supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_real, valor_liquido, valor_bruto, entrada, pontos(nome)"
      )
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .gte("created_at", thirtyFiveDaysAgo),
    supabase.from("pontos").select("*").eq("empresa_id", empresaId),
    supabase
      .from("pendencias")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "aberta"),
    supabase.from("estoque").select("quantidade").eq("empresa_id", empresaId),
    fetchCartelaPontos(supabase, empresaId),
    fetchSaudePontos(supabase, empresaId, "fura_fura"),
  ]);

  const list = coletasMes ?? [];
  const mesAtual = aggregateColetas(list);
  const mesAnterior = aggregateColetas(coletasMesAnterior ?? []);
  const totalBruto = mesAtual.totalBruto;
  const lucroReal = mesAtual.lucroReal;
  const totalFuros = mesAtual.furos;
  const pendenteColetas = list.reduce((s, c) => s + saldoPendenteColeta(c), 0);

  const pontosAtivos = pontos?.filter((p) => p.status === "ativo").length ?? 0;
  const pontosSemColeta =
    pontos?.filter(
      (p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo
    ).length ?? 0;
  const brindesEstoque = estoque?.reduce((s, e) => s + e.quantidade, 0) ?? 0;

  const rankingMap = new Map<string, number>();
  list.forEach((c) => {
    if (c.ponto_id) {
      rankingMap.set(
        c.ponto_id,
        (rankingMap.get(c.ponto_id) ?? 0) + Number(c.lucro_real ?? c.valor_liquido ?? 0)
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
    .filter((r): r is { ponto: Ponto; valor: number } => Boolean(r.ponto));

  const sparkline = sparklineFromDailyValues(
    list.map((c) => ({
      created_at: c.created_at,
      value: Number(c.lucro_real ?? c.valor_liquido ?? 0),
    }))
  );

  const pulso: PulsoOperacao = computePulsoOperacao(
    (coletasPulso ?? []).map((c) => {
      const lucro = Number(c.lucro_real ?? c.valor_liquido ?? c.valor_bruto ?? 0);
      return {
        created_at: c.created_at,
        lucroReais: lucro,
        negativa: lucro < -0.009,
      };
    })
  );

  return {
    stats: {
      total_mes: totalBruto,
      lucro_estimado: lucroReal,
      pontos_ativos: pontosAtivos,
      pontos_pendentes: pontosSemColeta,
      coletas_realizadas: list.length,
      brindes_estoque: brindesEstoque,
      pendencias: pendenciasCount ?? 0,
      receita_mes: totalBruto,
      furos_mes: totalFuros,
      a_receber_pendente: pendenteColetas,
    },
    ranking,
    pontosSemColeta,
    sparkline,
    pulso,
    cartela,
    saude,
    comparativo: { mesAtual, mesAnterior },
  };
}
