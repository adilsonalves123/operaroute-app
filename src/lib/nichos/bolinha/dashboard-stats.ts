import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import { fetchCartelaPontos } from "@/lib/dashboard-cartela-pontos";
import { computePulsoOperacao, type PulsoOperacao } from "@/lib/dashboard-pulso";
import {
  buildSaudeResumoFromEventos,
  coletasToEventosPonto,
  type SaudePontosResumo,
} from "@/lib/dashboard-saude-pontos";
import { fetchDashboardPontosBase } from "@/lib/dashboard-pontos-base";
import { fetchPendenciasAbertas } from "@/lib/dashboard-pendencias-abertas";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import type { Ponto } from "@/lib/types/database";
import type { DashboardPeriodoFiltro } from "@/lib/dashboard-periodo";

function startOfPreviousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
}

function endOfPreviousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
}

function sparklineFromDailyValues(rows: { created_at: string; value: number }[]): number[] {
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

export async function getBolinhaDashboardStats(
  supabase: SupabaseClient,
  empresaId: string,
  periodo: DashboardPeriodoFiltro
) {
  const { inicioISO, fimISO } = periodo;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: coletasMes },
    { data: coletasMesAnterior },
    { data: coletasPulso },
    { data: coletasPendentesAbertas },
    pontos,
    pendenciasAbertas,
    { count: maquinasAtivas },
    cartela,
  ] = await Promise.all([
    supabase
      .from("coletas")
      .select(
        "valor_bruto, lucro_real, valor_liquido, custo_brindes, valor_a_receber, valor_pago_recebido, entrada_periodo, ponto_id, created_at"
      )
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO),
    supabase
      .from("coletas")
      .select("valor_bruto, lucro_real, valor_liquido, custo_brindes, entrada_periodo")
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
      .gte("created_at", startOfPreviousMonth())
      .lte("created_at", endOfPreviousMonth()),
    supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_real, valor_liquido, valor_bruto, entrada, pontos(nome)"
      )
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
      .gte("created_at", thirtyFiveDaysAgo),
    supabase
      .from("coletas")
      .select("valor_a_receber, valor_pago_recebido")
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
      .gt("valor_a_receber", 0),
    fetchDashboardPontosBase(supabase, empresaId),
    fetchPendenciasAbertas(supabase, empresaId),
    supabase
      .from("equipamentos")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("tipo", "bolinha")
      .eq("status", "ativo"),
    fetchCartelaPontos(supabase, empresaId),
  ]);

  const pendenciasCount = pendenciasAbertas.length;
  const list = coletasMes ?? [];
  const mesAtualLucro = list.reduce(
    (s, c) => s + Number(c.lucro_real ?? c.valor_liquido ?? 0),
    0
  );
  const mesAnteriorLucro = (coletasMesAnterior ?? []).reduce(
    (s, c) => s + Number(c.lucro_real ?? c.valor_liquido ?? 0),
    0
  );
  const totalBruto = list.reduce((s, c) => s + Number(c.valor_bruto ?? 0), 0);
  const custoBrindes = list.reduce((s, c) => s + Number(c.custo_brindes ?? 0), 0);
  const aReceberPendente = (coletasPendentesAbertas ?? []).reduce(
    (s, c) =>
      s + Math.max(0, Number(c.valor_a_receber ?? 0) - Number(c.valor_pago_recebido ?? 0)),
    0
  );
  const entradaTotal = list.reduce(
    (s, c) =>
      s +
      (c.entrada_periodo != null
        ? centesimosToReais(Number(c.entrada_periodo))
        : Number(c.valor_bruto ?? 0)),
    0
  );

  const pontosAtivos = pontos?.filter((p) => p.status === "ativo").length ?? 0;
  const pontosSemColeta =
    pontos?.filter((p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo)
      .length ?? 0;

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

  const saude: SaudePontosResumo = buildSaudeResumoFromEventos(
    coletasToEventosPonto((coletasPulso ?? []) as Parameters<typeof coletasToEventosPonto>[0]),
    (pontos ?? []).filter((p) => p.status === "ativo").map((p) => ({ id: p.id, nome: p.nome }))
  );

  return {
    stats: {
      entrada_total: entradaTotal,
      saldo_liquido: mesAtualLucro,
      lucro_estimado: mesAtualLucro,
      custo_brindes: custoBrindes,
      a_receber_pendente: aReceberPendente,
      pontos_ativos: pontosAtivos,
      pontos_pendentes: pontosSemColeta,
      coletas_realizadas: list.length,
      maquinas_ativas: maquinasAtivas ?? 0,
      clientes_ativos: pontosAtivos,
      pendencias: pendenciasCount ?? 0,
      receita_mes: totalBruto,
      total_mes: totalBruto,
    },
    ranking,
    pontosSemColeta,
    sparkline,
    pulso,
    cartela,
    saude,
    comparativo: {
      mesAtual: { lucroReal: mesAtualLucro, coletas: list.length },
      mesAnterior: { lucroReal: mesAnteriorLucro, coletas: coletasMesAnterior?.length ?? 0 },
    },
  };
}
