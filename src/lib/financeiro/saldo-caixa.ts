import type { SupabaseClient } from "@supabase/supabase-js";
import { breakdownLancamento, type VisitaFinanceiro } from "@/lib/financeiro/breakdown";

/**
 * Saldo real do caixa da empresa: entradas − saídas (todo o histórico).
 * Usado para não deixar o caixa ir abaixo de zero em saídas.
 * Query leve (sem join) — segura no client e nas APIs.
 */
export async function fetchSaldoCaixa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("financeiro")
    .select("tipo, valor")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("[saldo-caixa]", error.message);
    return 0;
  }

  let saldo = 0;
  for (const row of data ?? []) {
    const v = Number(row.valor ?? 0);
    if (!Number.isFinite(v)) continue;
    if (row.tipo === "entrada") saldo += v;
    else if (row.tipo === "saida") saldo -= v;
  }
  return saldo;
}

export type ComposicaoCaixa = {
  /** Entradas − saídas (pode ser negativo em bases antigas). */
  saldo: number;
  /** Parte Pix do caixa (líquido de entradas − saídas classificadas). */
  pix: number;
  /** Parte dinheiro do caixa. */
  dinheiro: number;
  /**
   * Lançamentos sem forma clara (misto sem detalhe, forma nula, etc.).
   * Explica quando Pix + Dinheiro ≠ saldo.
   */
  naoClassificado: number;
};

/**
 * Distribui o valor do lançamento em Pix / dinheiro / não classificado.
 * Escala o split da visita quando o valor do financeiro ≠ pix+dinheiro da visita.
 */
export function classificarValorCaixa(l: {
  tipo: string;
  valor: number;
  forma_pagamento: string | null;
  descricao: string | null;
  visitas?: VisitaFinanceiro;
}): { pix: number; dinheiro: number; naoClassificado: number } {
  const valor = Math.max(0, Number(l.valor ?? 0));
  if (valor <= 0.009) return { pix: 0, dinheiro: 0, naoClassificado: 0 };

  const b = breakdownLancamento(l);
  const classificado = Math.max(0, b.pix) + Math.max(0, b.dinheiro);

  if (classificado > 0.009) {
    if (Math.abs(classificado - valor) <= 0.05) {
      return {
        pix: Math.max(0, b.pix),
        dinheiro: Math.max(0, b.dinheiro),
        naoClassificado: 0,
      };
    }
    const fator = valor / classificado;
    return {
      pix: Math.max(0, b.pix) * fator,
      dinheiro: Math.max(0, b.dinheiro) * fator,
      naoClassificado: 0,
    };
  }

  const forma = String(l.forma_pagamento ?? "").toLowerCase();
  if (forma === "pix") return { pix: valor, dinheiro: 0, naoClassificado: 0 };
  if (forma === "dinheiro") return { pix: 0, dinheiro: valor, naoClassificado: 0 };

  return { pix: 0, dinheiro: 0, naoClassificado: valor };
}

/** Saldo + composição Pix/Dinheiro sobre TODO o histórico financeiro. */
export async function fetchComposicaoCaixa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<ComposicaoCaixa> {
  const { data, error } = await supabase
    .from("financeiro")
    .select(
      "tipo, valor, forma_pagamento, descricao, visita_id, visitas(valor_pix, valor_dinheiro, debito_abatido, desconto, desconto_recebimento)"
    )
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("[composicao-caixa]", error.message);
    return { saldo: 0, pix: 0, dinheiro: 0, naoClassificado: 0 };
  }

  let saldo = 0;
  let pix = 0;
  let dinheiro = 0;
  let naoClassificado = 0;

  for (const row of data ?? []) {
    const v = Number(row.valor ?? 0);
    if (!Number.isFinite(v)) continue;

    const visitasRaw = row.visitas as VisitaFinanceiro | VisitaFinanceiro[] | null | undefined;
    const visita = Array.isArray(visitasRaw) ? visitasRaw[0] ?? null : visitasRaw ?? null;

    const parte = classificarValorCaixa({
      tipo: String(row.tipo ?? ""),
      valor: v,
      forma_pagamento: (row.forma_pagamento as string | null) ?? null,
      descricao: (row.descricao as string | null) ?? null,
      visitas: visita,
    });

    if (row.tipo === "entrada") {
      saldo += v;
      pix += parte.pix;
      dinheiro += parte.dinheiro;
      naoClassificado += parte.naoClassificado;
    } else if (row.tipo === "saida") {
      saldo -= v;
      pix -= parte.pix;
      dinheiro -= parte.dinheiro;
      naoClassificado -= parte.naoClassificado;
    }
  }

  return {
    saldo,
    pix,
    dinheiro,
    naoClassificado,
  };
}

/** Quanto pode sair do caixa sem deixar saldo negativo (já negativo conta como 0 disponível). */
export function valorSaidaPermitidaNoCaixa(
  saldoAtual: number,
  saidaDesejada: number
): number {
  const disponivel = Math.max(0, saldoAtual);
  const desejada = Math.max(0, saidaDesejada);
  return Math.min(desejada, disponivel);
}
