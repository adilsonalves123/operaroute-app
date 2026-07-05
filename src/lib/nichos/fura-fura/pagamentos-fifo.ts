export type ColetaPendente = {
  id: string;
  created_at: string;
  valor_a_receber: number;
  valor_pago_recebido: number;
};

export type DistribuicaoPagamento = {
  coletaId: string;
  valor: number;
  saldoAntes: number;
  saldoDepois: number;
};

export function distribuirPagamentoFifo(
  coletas: ColetaPendente[],
  valorTotal: number
): { distribuicoes: DistribuicaoPagamento[]; valorAplicado: number; valorSobra: number } {
  const sorted = [...coletas].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let remaining = Math.max(0, Math.round(valorTotal * 100) / 100);
  const distribuicoes: DistribuicaoPagamento[] = [];

  for (const col of sorted) {
    if (remaining <= 0.009) break;

    const aReceber = Number(col.valor_a_receber ?? 0);
    const pago = Number(col.valor_pago_recebido ?? 0);
    const saldo = Math.round((aReceber - pago) * 100) / 100;
    if (saldo <= 0.009) continue;

    const aplicar = Math.min(remaining, saldo);
    distribuicoes.push({
      coletaId: col.id,
      valor: aplicar,
      saldoAntes: saldo,
      saldoDepois: Math.round((saldo - aplicar) * 100) / 100,
    });
    remaining = Math.round((remaining - aplicar) * 100) / 100;
  }

  const valorAplicado = Math.round((valorTotal - remaining) * 100) / 100;
  return { distribuicoes, valorAplicado, valorSobra: remaining };
}

export function saldoPendenteColeta(coleta: {
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
}): number {
  const aReceber = Number(coleta.valor_a_receber ?? 0);
  const pago = Number(coleta.valor_pago_recebido ?? 0);
  return Math.max(0, Math.round((aReceber - pago) * 100) / 100);
}
