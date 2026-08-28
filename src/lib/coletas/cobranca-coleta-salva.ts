import type { RelatorioCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type ColetaCobrancaSalvaRow = {
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
  divida_quitada?: number | null;
  haver_gerado?: number | null;
};

export function totalPagoInformadoColeta(coleta: ColetaCobrancaSalvaRow): number {
  return round2(Number(coleta.valor_pix ?? 0) + Number(coleta.valor_dinheiro ?? 0));
}

/** Dívida/haver quitados nesta coleta (histórico e novas). */
export function cobrancaDetalheFromColetaSalva(
  coleta: ColetaCobrancaSalvaRow
): RelatorioCobrancaDetalhe | null {
  const valorOperacao = round2(Number(coleta.valor_a_receber ?? 0));
  const recebidoOperacao = round2(Number(coleta.valor_pago_recebido ?? 0));
  const totalPago = totalPagoInformadoColeta(coleta);

  let dividaAnterior = round2(Number(coleta.divida_quitada ?? 0));
  let haverGerado = round2(Number(coleta.haver_gerado ?? 0));

  if (dividaAnterior <= 0.009 && totalPago > recebidoOperacao + 0.009) {
    const excesso = round2(totalPago - recebidoOperacao);
    if (haverGerado > 0.009) {
      dividaAnterior = round2(Math.max(0, excesso - haverGerado));
    } else {
      dividaAnterior = excesso;
    }
  }

  if (dividaAnterior <= 0.009 && haverGerado <= 0.009) return null;

  const totalACobrar = round2(valorOperacao + dividaAnterior);

  return {
    dividaAnterior: dividaAnterior > 0.009 ? dividaAnterior : undefined,
    haverAnterior: undefined,
    haverAbatido: undefined,
    totalACobrar:
      totalACobrar > valorOperacao + 0.009 || totalPago > valorOperacao + 0.009
        ? Math.max(totalACobrar, totalPago)
        : undefined,
  };
}
