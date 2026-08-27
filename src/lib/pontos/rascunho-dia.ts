import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { lucroOperacaoCassinoVisita } from "@/lib/nichos/cassino/lucro-recebido";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RascunhoDiaDados = {
  data: string;
  porPonto: Record<string, number>;
  pix: number;
  dinheiro: number;
};

/**
 * Valores por ponto no dia (folha da rota): o que cada ponto gerou na operação.
 * Cassino: visitas (lucro da operação na coleta).
 * Demais nichos: coletas sem visita_id de cassino (lucro_real / valor_liquido).
 */
export async function fetchRascunhoDia(
  supabase: SupabaseClient,
  empresaId: string,
  dataISO: string
): Promise<RascunhoDiaDados> {
  const vazio: RascunhoDiaDados = {
    data: dataISO,
    porPonto: {},
    pix: 0,
    dinheiro: 0,
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return vazio;

  const periodo = resolverPeriodoAnalise({
    periodo: "personalizado",
    de: dataISO,
    ate: dataISO,
  });

  try {
    const [{ data: visitas }, { data: coletas }] = await Promise.all([
      supabase
        .from("visitas")
        .select(
          "ponto_id, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, saldo_negativo, valor_pix, valor_dinheiro, adiantamento_pix, adiantamento_dinheiro"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO),
      supabase
        .from("coletas")
        .select(
          "ponto_id, lucro_real, valor_liquido, valor_pix, valor_dinheiro, visita_id"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO)
        .is("visita_id", null),
    ]);

    const porPonto = new Map<string, number>();
    let pix = 0;
    let dinheiro = 0;

    for (const v of visitas ?? []) {
      if (!v.ponto_id) continue;
      const valor = lucroOperacaoCassinoVisita(v);
      if (Math.abs(valor) > 0.0001) {
        porPonto.set(v.ponto_id, round2((porPonto.get(v.ponto_id) ?? 0) + valor));
      }

      const negativa =
        Boolean(v.saldo_negativo) ||
        Number(v.total_lucro_centavos ?? 0) < -0.9;
      if (negativa) {
        pix += Number(v.adiantamento_pix ?? 0);
        dinheiro += Number(v.adiantamento_dinheiro ?? 0);
      } else {
        pix += Number(v.valor_pix ?? 0);
        dinheiro += Number(v.valor_dinheiro ?? 0);
      }
    }

    for (const c of coletas ?? []) {
      if (!c.ponto_id) continue;
      const valor = Number(c.lucro_real ?? c.valor_liquido ?? 0);
      if (Math.abs(valor) > 0.0001) {
        porPonto.set(c.ponto_id, round2((porPonto.get(c.ponto_id) ?? 0) + valor));
      }
      pix += Number(c.valor_pix ?? 0);
      dinheiro += Number(c.valor_dinheiro ?? 0);
    }

    const porPontoObj: Record<string, number> = {};
    for (const [id, valor] of porPonto) {
      if (Math.abs(valor) > 0.0001) porPontoObj[id] = valor;
    }

    return {
      data: dataISO,
      porPonto: porPontoObj,
      pix: round2(pix),
      dinheiro: round2(dinheiro),
    };
  } catch {
    return vazio;
  }
}
