import { centesimosToReais } from "./contadores";
import type { MaquinaCalculo, MaquinaDistribuida } from "./types";

/**
 * Distribui comissão/descontos proporcionalmente ao lucro positivo de cada máquina.
 * valorOperacao proporcional ao lucro total (inclui negativas).
 * Restante dividido igualmente (1/N).
 */
export function distribuirValoresMaquinas(
  maquinas: MaquinaCalculo[],
  valorClienteReais: number,
  valorOperacaoReais: number,
  descontoManualReais: number,
  restanteReais: number
): MaquinaDistribuida[] {
  const n = maquinas.length;
  if (n === 0) return [];

  const lucrosPositivos = maquinas.map((m) => Math.max(0, m.lucroCentavos));
  const somaPositivos = lucrosPositivos.reduce((s, v) => s + v, 0);
  const somaLucroTotal = maquinas.reduce((s, m) => s + m.lucroCentavos, 0);

  const restantePorMaquina = restanteReais / n;

  return maquinas.map((m, i) => {
    const pesoPositivo =
      somaPositivos > 0 ? lucrosPositivos[i] / somaPositivos : 1 / n;
    const pesoTotal =
      somaLucroTotal !== 0
        ? m.lucroCentavos / somaLucroTotal
        : 1 / n;

    return {
      ...m,
      valorClienteReais: valorClienteReais * pesoPositivo,
      descontoReais: descontoManualReais * pesoPositivo,
      valorOperacaoReais: valorOperacaoReais * pesoTotal,
      restanteReais: restantePorMaquina,
    };
  });
}

/** Arredonda distribuição para bater com totais da visita */
export function ajustarArredondamento(
  distribuidas: MaquinaDistribuida[],
  totais: {
    valorClienteReais: number;
    valorOperacaoReais: number;
    restanteReais: number;
  }
): MaquinaDistribuida[] {
  if (distribuidas.length === 0) return [];

  const result = [...distribuidas];
  const last = result.length - 1;

  const somaCliente = result.reduce((s, m) => s + m.valorClienteReais, 0);
  const somaOperacao = result.reduce((s, m) => s + m.valorOperacaoReais, 0);
  const somaRestante = result.reduce((s, m) => s + m.restanteReais, 0);

  result[last] = {
    ...result[last],
    valorClienteReais:
      result[last].valorClienteReais + (totais.valorClienteReais - somaCliente),
    valorOperacaoReais:
      result[last].valorOperacaoReais + (totais.valorOperacaoReais - somaOperacao),
    restanteReais:
      result[last].restanteReais + (totais.restanteReais - somaRestante),
  };

  return result;
}

export function lucroMaquinaReais(m: MaquinaCalculo): number {
  return centesimosToReais(m.lucroCentavos);
}
