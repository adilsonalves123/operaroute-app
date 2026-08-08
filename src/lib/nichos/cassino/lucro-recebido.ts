import { centesimosToReais } from "@/lib/nichos/cassino/contadores";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type VisitaCassinoLucroInput = {
  saldo_negativo?: boolean | null;
  total_lucro_centavos?: number | null;
  valor_operacao?: number | null;
  valor_operacao_efetivo?: number | null;
  valor_pago?: number | null;
  restante?: number | null;
  /** Em visita negativa grava o valor deixado pelo operador (saída de caixa). */
  desconto?: number | null;
  adiantamento_pix?: number | null;
  adiantamento_dinheiro?: number | null;
};

/**
 * Resultado da visita para o dashboard (regra Fura): conta na hora da coleta,
 * mesmo se o cliente ainda não pagou.
 * - Positiva: valor da operação (sua parte)
 * - Negativa: lucro de máquina (prejuízo)
 */
export function lucroOperacaoCassinoVisita(v: VisitaCassinoLucroInput): number {
  const lucroMaquina = centesimosToReais(Number(v.total_lucro_centavos ?? 0));
  if (Boolean(v.saldo_negativo) || lucroMaquina < -0.009) {
    return round2(lucroMaquina);
  }
  return round2(
    Math.max(0, Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0))
  );
}

/** Dinheiro efetivamente deixado no ponto em visita negativa (sai do bolso/caixa). */
export function valorDeixadoNegativoCassino(v: VisitaCassinoLucroInput): number {
  const desconto = Math.max(0, Number(v.desconto ?? 0));
  const adiantamento = Math.max(
    0,
    Number(v.adiantamento_pix ?? 0) + Number(v.adiantamento_dinheiro ?? 0)
  );
  return round2(Math.max(desconto, adiantamento));
}

/**
 * Lucro líquido da Análise (visão real da operação):
 * - Positiva: o que entrou em dinheiro (valor_pago), limitado à operação gerada.
 *   Haver abatido não conta como dinheiro recebido.
 * - Negativa: reduz pelo valor deixado (saída de caixa). Pode ir abaixo de zero
 *   no consolidado do período — diferente do saldo de caixa, que pode estar limitado.
 *
 * Importante: abater pendência de operação em visita negativa NÃO deve inflar
 * `valor_pago` da visita de origem (ver sync-visita-baixa semRecebimento).
 * Caso contrário a Análise conta dinheiro que só mudou de nome (pendência → negativo).
 *
 * O 2º argumento permanece por compatibilidade com callers antigos.
 */
export function liquidoRecebidoCassinoVisita(
  v: VisitaCassinoLucroInput,
  _openPendOperacaoReais = 0
): number {
  const lucroMaquina = centesimosToReais(Number(v.total_lucro_centavos ?? 0));
  const negativa = Boolean(v.saldo_negativo) || lucroMaquina < -0.009;

  if (negativa) {
    const deixado = valorDeixadoNegativoCassino(v);
    return deixado > 0.009 ? round2(-deixado) : 0;
  }

  const gerado = Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0);
  if (gerado <= 0.009) return 0;

  const pago = Math.max(0, Number(v.valor_pago ?? 0));
  return round2(Math.min(gerado, pago));
}
