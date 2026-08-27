import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { lucroOperacaoCassinoVisita } from "@/lib/nichos/cassino/lucro-recebido";
import type { FormaPagamento } from "@/lib/types/database";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RascunhoFormaPagamento = FormaPagamento | null;

export type RascunhoPontoDia = {
  valor: number;
  pix: number;
  dinheiro: number;
  forma: RascunhoFormaPagamento;
};

export type RascunhoDiaDados = {
  data: string;
  porPonto: Record<string, RascunhoPontoDia>;
  pix: number;
  dinheiro: number;
};

function inferirForma(pix: number, dinheiro: number): RascunhoFormaPagamento {
  const temPix = pix > 0.0001;
  const temDinheiro = dinheiro > 0.0001;
  if (temPix && temDinheiro) return "misto";
  if (temPix) return "pix";
  if (temDinheiro) return "dinheiro";
  return null;
}

/** Quando valor_pix/dinheiro não foram gravados, usa forma_pagamento + valor recebido. */
function resolverPixDinheiro(opts: {
  forma?: string | null;
  pix?: number | null;
  dinheiro?: number | null;
  valorReferencia?: number | null;
}): { pix: number; dinheiro: number; forma: RascunhoFormaPagamento } {
  let pix = Math.max(0, Number(opts.pix ?? 0));
  let dinheiro = Math.max(0, Number(opts.dinheiro ?? 0));
  const ref = Math.max(0, Number(opts.valorReferencia ?? 0));
  const forma = (opts.forma ?? "").toLowerCase();

  if (pix + dinheiro < 0.0001 && ref > 0.0001) {
    if (forma === "pix") pix = ref;
    else if (forma === "dinheiro") dinheiro = ref;
  }

  return {
    pix: round2(pix),
    dinheiro: round2(dinheiro),
    forma: inferirForma(pix, dinheiro),
  };
}

function somarPonto(
  map: Map<string, RascunhoPontoDia>,
  pontoId: string,
  add: { valor?: number; pix?: number; dinheiro?: number }
) {
  const prev = map.get(pontoId) ?? { valor: 0, pix: 0, dinheiro: 0, forma: null };
  const pix = round2(prev.pix + (add.pix ?? 0));
  const dinheiro = round2(prev.dinheiro + (add.dinheiro ?? 0));
  map.set(pontoId, {
    valor: round2(prev.valor + (add.valor ?? 0)),
    pix,
    dinheiro,
    forma: inferirForma(pix, dinheiro),
  });
}

/**
 * Valores por ponto no dia (folha da rota): o que cada ponto gerou na operação
 * e como pagou (Pix / Dinheiro / misto).
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
          "ponto_id, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, saldo_negativo, valor_pago, valor_pix, valor_dinheiro, adiantamento_pix, adiantamento_dinheiro, forma_pagamento"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO),
      supabase
        .from("coletas")
        .select(
          "ponto_id, lucro_real, valor_liquido, valor_pago_recebido, valor_pix, valor_dinheiro, forma_pagamento, visita_id"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO)
        .is("visita_id", null),
    ]);

    const porPonto = new Map<string, RascunhoPontoDia>();
    let pix = 0;
    let dinheiro = 0;

    for (const v of visitas ?? []) {
      if (!v.ponto_id) continue;
      const valor = lucroOperacaoCassinoVisita(v);
      const negativa =
        Boolean(v.saldo_negativo) ||
        Number(v.total_lucro_centavos ?? 0) < -0.9;

      const pagamento = negativa
        ? {
            pix: Number(v.adiantamento_pix ?? 0),
            dinheiro: Number(v.adiantamento_dinheiro ?? 0),
            forma: inferirForma(
              Number(v.adiantamento_pix ?? 0),
              Number(v.adiantamento_dinheiro ?? 0)
            ),
          }
        : resolverPixDinheiro({
            forma: v.forma_pagamento,
            pix: v.valor_pix,
            dinheiro: v.valor_dinheiro,
            valorReferencia: v.valor_pago,
          });

      if (Math.abs(valor) > 0.0001 || pagamento.pix > 0 || pagamento.dinheiro > 0) {
        somarPonto(porPonto, v.ponto_id, {
          valor,
          pix: pagamento.pix,
          dinheiro: pagamento.dinheiro,
        });
      }

      pix += pagamento.pix;
      dinheiro += pagamento.dinheiro;
    }

    for (const c of coletas ?? []) {
      if (!c.ponto_id) continue;
      const valor = Number(c.lucro_real ?? c.valor_liquido ?? 0);
      const pagamento = resolverPixDinheiro({
        forma: c.forma_pagamento,
        pix: c.valor_pix,
        dinheiro: c.valor_dinheiro,
        valorReferencia: c.valor_pago_recebido ?? valor,
      });

      if (Math.abs(valor) > 0.0001 || pagamento.pix > 0 || pagamento.dinheiro > 0) {
        somarPonto(porPonto, c.ponto_id, {
          valor,
          pix: pagamento.pix,
          dinheiro: pagamento.dinheiro,
        });
      }

      pix += pagamento.pix;
      dinheiro += pagamento.dinheiro;
    }

    const porPontoObj: Record<string, RascunhoPontoDia> = {};
    for (const [id, item] of porPonto) {
      if (
        Math.abs(item.valor) > 0.0001 ||
        item.pix > 0.0001 ||
        item.dinheiro > 0.0001
      ) {
        porPontoObj[id] = item;
      }
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
