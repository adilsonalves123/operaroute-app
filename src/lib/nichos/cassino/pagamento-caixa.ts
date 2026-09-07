/**
 * Recebimento de verdade = pix/dinheiro informados.
 * Checkout multi-nicho sem pagamento gravava valor_pago = cobrável e zerava
 * restante, o que fazia o histórico cassino parecer quitado.
 */
export function valorPagoCaixaVisita(v: {
  valor_pago?: number | null;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
  restante?: number | null;
}): number {
  const pago = Math.max(0, Number(v.valor_pago ?? 0));
  const temSplit = v.valor_pix !== undefined || v.valor_dinheiro !== undefined;
  if (!temSplit) return pago;

  const caixa =
    Math.max(0, Number(v.valor_pix ?? 0)) + Math.max(0, Number(v.valor_dinheiro ?? 0));
  if (caixa > 0.009) return Math.max(pago, caixa);

  const restante = Math.max(0, Number(v.restante ?? 0));
  if (pago > 0.009 && restante > 0.009) return pago;
  return 0;
}
