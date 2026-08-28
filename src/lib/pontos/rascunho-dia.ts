import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { valorDeixadoNegativoCassino } from "@/lib/nichos/cassino/lucro-recebido";
import type { FormaPagamento } from "@/lib/types/database";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RascunhoFormaPagamento = FormaPagamento | null;

export type RascunhoPontoDia = {
  /** Quanto entrou (ou saiu, se negativo) naquele ponto no dia. */
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
  /** Entradas brutas (antes de descontar o deixado no ponto). */
  recebido: number;
  /** Valor deixado em visita(s) negativa(s). */
  deixado: number;
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
    else if (forma === "misto") {
      pix = round2(ref / 2);
      dinheiro = round2(ref - pix);
    }
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
  add: { recebido: number; pix: number; dinheiro: number }
) {
  const prev = map.get(pontoId) ?? { valor: 0, pix: 0, dinheiro: 0, forma: null };
  const pix = round2(prev.pix + add.pix);
  const dinheiro = round2(prev.dinheiro + add.dinheiro);
  map.set(pontoId, {
    valor: round2(prev.valor + add.recebido),
    pix,
    dinheiro,
    forma: inferirForma(pix, dinheiro),
  });
}

/**
 * Folha da rota: quanto cada ponto mandou no dia (Pix + Dinheiro recebidos).
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
    recebido: 0,
    deixado: 0,
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
          "ponto_id, total_lucro_centavos, saldo_negativo, valor_pago, valor_pix, valor_dinheiro, adiantamento_pix, adiantamento_dinheiro, desconto, forma_pagamento"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO),
      supabase
        .from("coletas")
        .select(
          "ponto_id, valor_pago_recebido, valor_pix, valor_dinheiro, forma_pagamento, visita_id"
        )
        .eq("empresa_id", empresaId)
        .gte("created_at", periodo.inicioISO)
        .lte("created_at", periodo.fimISO)
        .is("visita_id", null),
    ]);

    const porPonto = new Map<string, RascunhoPontoDia>();
    let pix = 0;
    let dinheiro = 0;
    let entradaPix = 0;
    let entradaDinheiro = 0;
    let deixado = 0;

    for (const v of visitas ?? []) {
      if (!v.ponto_id) continue;
      const negativa =
        Boolean(v.saldo_negativo) ||
        Number(v.total_lucro_centavos ?? 0) < -0.9;

      if (negativa) {
        const pPix = Math.max(0, Number(v.adiantamento_pix ?? 0));
        const pDin = Math.max(0, Number(v.adiantamento_dinheiro ?? 0));
        const deixadoVisita = valorDeixadoNegativoCassino(v);
        if (deixadoVisita <= 0.009) continue;

        deixado += deixadoVisita;
        const recebido = -deixadoVisita;
        if (pPix + pDin > 0.009) {
          somarPonto(porPonto, v.ponto_id, {
            recebido,
            pix: -pPix,
            dinheiro: -pDin,
          });
          pix -= pPix;
          dinheiro -= pDin;
        } else {
          somarPonto(porPonto, v.ponto_id, {
            recebido,
            pix: 0,
            dinheiro: -deixadoVisita,
          });
          dinheiro -= deixadoVisita;
        }
        continue;
      }

      const pagamento = resolverPixDinheiro({
        forma: v.forma_pagamento,
        pix: v.valor_pix,
        dinheiro: v.valor_dinheiro,
        valorReferencia: v.valor_pago,
      });
      const recebido = round2(pagamento.pix + pagamento.dinheiro);
      if (recebido > 0.0001) {
        somarPonto(porPonto, v.ponto_id, {
          recebido,
          pix: pagamento.pix,
          dinheiro: pagamento.dinheiro,
        });
        pix += pagamento.pix;
        dinheiro += pagamento.dinheiro;
        entradaPix += pagamento.pix;
        entradaDinheiro += pagamento.dinheiro;
      }
    }

    for (const c of coletas ?? []) {
      if (!c.ponto_id) continue;
      const pagamento = resolverPixDinheiro({
        forma: c.forma_pagamento,
        pix: c.valor_pix,
        dinheiro: c.valor_dinheiro,
        valorReferencia: c.valor_pago_recebido,
      });
      const recebido = round2(pagamento.pix + pagamento.dinheiro);
      if (recebido > 0.0001) {
        somarPonto(porPonto, c.ponto_id, {
          recebido,
          pix: pagamento.pix,
          dinheiro: pagamento.dinheiro,
        });
        pix += pagamento.pix;
        dinheiro += pagamento.dinheiro;
        entradaPix += pagamento.pix;
        entradaDinheiro += pagamento.dinheiro;
      }
    }

    const porPontoObj: Record<string, RascunhoPontoDia> = {};
    for (const [id, item] of porPonto) {
      if (
        Math.abs(item.valor) > 0.0001 ||
        Math.abs(item.pix) > 0.0001 ||
        Math.abs(item.dinheiro) > 0.0001
      ) {
        porPontoObj[id] = item;
      }
    }

    return {
      data: dataISO,
      porPonto: porPontoObj,
      pix: round2(pix),
      dinheiro: round2(dinheiro),
      recebido: round2(entradaPix + entradaDinheiro),
      deixado: round2(deixado),
    };
  } catch {
    return vazio;
  }
}
