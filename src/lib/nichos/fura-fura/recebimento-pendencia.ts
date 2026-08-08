function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RecebimentoComPendencia = {
  aplicadoColetaAtual: number;
  aplicadoDividaAnterior: number;
  saldoPendenteColeta: number;
  saldoPendenteDivida: number;
  haver: number;
  quitadoColeta: boolean;
  quitadoOperacao: boolean;
};

/** Rateia pagamento: coleta atual → dívida anterior → haver. */
export function calcularRecebimentoComPendencia(
  valorAReceberColeta: number,
  valorPagoTotal: number,
  pendenciaAnterior = 0
): RecebimentoComPendencia {
  const pago = Math.max(0, valorPagoTotal);
  const aReceber = Math.max(0, valorAReceberColeta);
  const divida = Math.max(0, pendenciaAnterior);

  const aplicadoColetaAtual = round2(Math.min(pago, aReceber));
  const resto = round2(pago - aplicadoColetaAtual);
  const aplicadoDividaAnterior = round2(Math.min(resto, divida));
  const haver = round2(Math.max(0, resto - aplicadoDividaAnterior));

  const saldoPendenteColeta = round2(Math.max(0, aReceber - aplicadoColetaAtual));
  const saldoPendenteDivida = round2(Math.max(0, divida - aplicadoDividaAnterior));

  return {
    aplicadoColetaAtual,
    aplicadoDividaAnterior,
    saldoPendenteColeta,
    saldoPendenteDivida,
    haver,
    quitadoColeta: saldoPendenteColeta <= 0.009,
    quitadoOperacao: saldoPendenteColeta <= 0.009 && saldoPendenteDivida <= 0.009,
  };
}
