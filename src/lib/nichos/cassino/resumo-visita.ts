import { centesimosToReais } from "./contadores";
import type { CalculoVisitaResult } from "./types";

export type ResumoTotalVisita = {
  label: string;
  valorReais: number;
  hint?: string;
  tipo: "cobrar" | "pagar";
};

export type LinhaQuemPagouNegativo = {
  id: string;
  label: string;
  valorReais: number;
  hint?: string;
  tipo: "operador" | "ponto" | "haver-usado" | "pendencia-operacao";
};

export type DisplayOperacaoNegativa = {
  prejuizoVisitaReais: number;
  fechamento: LinhaQuemPagouNegativo[];
  linhasReceberDoPonto: LinhaQuemPagouNegativo[];
  negativoAnteriorReais: number;
  negativoAdiantadoHojeReais: number;
  negativoTotalProximaReais: number;
  mostrarNegativoAcumulado: boolean;
  mostrarSaldoLiquido: boolean;
  rotuloSaldoLiquido: string;
  valorSaldoLiquidoAbs: number;
};

function linhaRestantePrejuizoCliente(c: CalculoVisitaResult): LinhaQuemPagouNegativo | null {
  if (c.haverGeradoReais <= 0.009) return null;

  const operadorRepostou = c.valorDeixadoOperadorReais > 0.009;

  if (operadorRepostou) {
    return {
      id: "pendencia-restante",
      label: "Pendência desta visita",
      hint: "Restante do prejuízo — o cliente devia cobrir",
      valorReais: c.haverGeradoReais,
      tipo: "pendencia-operacao",
    };
  }

  return {
    id: "ponto-ganhadores",
    label: "Ponto pagou os ganhadores",
    hint: "Cliente pagou direto na máquina",
    valorReais: c.haverGeradoReais,
    tipo: "ponto",
  };
}

function linhasComposicaoPrejuizo(c: CalculoVisitaResult): LinhaQuemPagouNegativo[] {
  const linhas: LinhaQuemPagouNegativo[] = [];

  if (c.pendenciaOperacaoAbatidaReais > 0.009) {
    linhas.push({
      id: "pendencia-abatida",
      label: "Pendência anterior (coleta passada)",
      hint: "Cliente já devia — abatido nesta visita",
      valorReais: c.pendenciaOperacaoAbatidaReais,
      tipo: "pendencia-operacao",
    });
  }
  if (c.valorDeixadoOperadorReais > 0.009) {
    const aplicadoNoPrejuizo = Math.max(
      0,
      c.valorDeixadoOperadorReais - (c.excedenteDeixadoReais ?? 0)
    );
    if (aplicadoNoPrejuizo > 0.009) {
      linhas.push({
        id: "reposto",
        label: "Você repôs no ponto",
        hint: "Saiu do seu caixa hoje",
        valorReais: aplicadoNoPrejuizo,
        tipo: "operador",
      });
    }
    if ((c.excedenteDeixadoReais ?? 0) > 0.009) {
      linhas.push({
        id: "excedente",
        label: "Você deixou a mais",
        hint: "Vira pendência — ponto te deve",
        valorReais: c.excedenteDeixadoReais,
        tipo: "operador",
      });
    }
  }
  if (c.haverCompensadoReais > 0.009) {
    linhas.push({
      id: "haver-compensado",
      label: "Crédito anterior usado",
      hint: "Saldo a favor do ponto — compensado nesta visita",
      valorReais: c.haverCompensadoReais,
      tipo: "haver-usado",
    });
  }

  const restante = linhaRestantePrejuizoCliente(c);
  if (restante) linhas.push(restante);

  const prejuizoVisitaReais = centesimosToReais(Math.abs(c.totalLucroCentavos));
  if (linhas.length === 0 && prejuizoVisitaReais > 0.009) {
    linhas.push({
      id: "ponto-total",
      label: "Ponto pagou os ganhadores",
      hint: "Cliente pagou direto na máquina",
      valorReais: prejuizoVisitaReais,
      tipo: "ponto",
    });
  }

  return linhas;
}

/** Itens que compõem quanto o operador deve receber do ponto nesta visita. */
export function linhasReceberDoPontoNegativo(c: CalculoVisitaResult): LinhaQuemPagouNegativo[] {
  const linhas: LinhaQuemPagouNegativo[] = [];

  if (c.valorDeixadoOperadorReais > 0.009) {
    const aplicadoNoPrejuizo = Math.max(
      0,
      c.valorDeixadoOperadorReais - (c.excedenteDeixadoReais ?? 0)
    );
    if (aplicadoNoPrejuizo > 0.009) {
      linhas.push({
        id: "receber-reposto",
        label: "Você repôs hoje",
        hint: "Valor que saiu do seu caixa",
        valorReais: aplicadoNoPrejuizo,
        tipo: "operador",
      });
    }
    if ((c.excedenteDeixadoReais ?? 0) > 0.009) {
      linhas.push({
        id: "receber-excedente",
        label: "Excedente deixado",
        hint: "Pendência — ponto te deve a mais",
        valorReais: c.excedenteDeixadoReais,
        tipo: "pendencia-operacao",
      });
    }
  }
  if (c.pendenciaOperacaoAbatidaReais > 0.009) {
    linhas.push({
      id: "receber-pendencia-anterior",
      label: "Pendência anterior",
      hint: "Cliente devia de coleta passada",
      valorReais: c.pendenciaOperacaoAbatidaReais,
      tipo: "pendencia-operacao",
    });
  }

  if (c.haverGeradoReais > 0.009 && c.valorDeixadoOperadorReais > 0.009) {
    linhas.push({
      id: "receber-pendencia-visita",
      label: "Pendência desta visita",
      hint: "Restante do prejuízo — cliente devia",
      valorReais: c.haverGeradoReais,
      tipo: "pendencia-operacao",
    });
  } else if (c.haverGeradoReais > 0.009) {
    linhas.push({
      id: "receber-ponto-pagou",
      label: "Ponto pagou na máquina",
      hint: "Cliente pagou direto",
      valorReais: c.haverGeradoReais,
      tipo: "ponto",
    });
  }

  return linhas;
}

/** Apenas exibição — deriva rótulos do resultado já calculado. */
export type ResumoOperacaoNegativa = {
  prejuizoVisitaReais: number;
  negativoAnteriorReais: number;
  negativoDeixadoVisitaReais: number;
  negativoTotalProximaReais: number;
  linhasQuemPagou: LinhaQuemPagouNegativo[];
};

export function resumoOperacaoNegativa(c: CalculoVisitaResult): ResumoOperacaoNegativa {
  const prejuizoVisitaReais = centesimosToReais(Math.abs(c.totalLucroCentavos));
  const negativoAnteriorReais = c.debitoTotalReais;
  const negativoDeixadoVisitaReais = c.novoDebitoReais;
  const negativoTotalProximaReais = negativoAnteriorReais + negativoDeixadoVisitaReais;

  return {
    prejuizoVisitaReais,
    negativoAnteriorReais,
    negativoDeixadoVisitaReais,
    negativoTotalProximaReais,
    linhasQuemPagou: linhasComposicaoPrejuizo(c),
  };
}

/** Camada de exibição enxuta — evita repetir o mesmo valor em rótulos diferentes. */
export function displayOperacaoNegativa(c: CalculoVisitaResult): DisplayOperacaoNegativa {
  const r = resumoOperacaoNegativa(c);
  const mostrarNegativoAcumulado =
    r.prejuizoVisitaReais > 0.009 || r.negativoAnteriorReais > 0.009;
  const mostrarSaldoLiquido = Math.abs(c.saldoLiquidoReais) > 0.009;

  const rotuloSaldoLiquido =
    c.saldoLiquidoReais > 0
      ? "Você deve receber do ponto"
      : "Você deve ao ponto (líquido)";

  return {
    prejuizoVisitaReais: r.prejuizoVisitaReais,
    fechamento: r.linhasQuemPagou,
    linhasReceberDoPonto: linhasReceberDoPontoNegativo(c),
    negativoAnteriorReais: r.negativoAnteriorReais,
    negativoAdiantadoHojeReais: r.prejuizoVisitaReais,
    negativoTotalProximaReais: r.negativoAnteriorReais + r.prejuizoVisitaReais,
    mostrarNegativoAcumulado,
    mostrarSaldoLiquido,
    rotuloSaldoLiquido,
    valorSaldoLiquidoAbs: Math.abs(c.saldoLiquidoReais),
  };
}

/** Valor que o cliente paga nesta visita (lucro cobre parte do negativo — o restante fica em aberto). */
export function valorReceberClienteVisitaReais(c: CalculoVisitaResult): number {
  const temNegativoRecuperado =
    c.debitoTotalReais > 0.009 && c.recuperacaoNegativoReais > 0.009;
  const valorOperacaoCobranca =
    c.valorOperacaoEfetivoReais > 0.009 ? c.valorOperacaoEfetivoReais : c.valorOperacaoReais;

  if (temNegativoRecuperado) {
    const totalSemHaver =
      c.recuperacaoNegativoReais +
      valorOperacaoCobranca +
      c.pendenciaOperacaoIncluidaReais;
    if (c.haverCompensadoReais > 0.009 && totalSemHaver > c.totalACobrarReais + 0.009) {
      return c.totalACobrarReais;
    }
    return totalSemHaver;
  }
  return c.totalACobrarReais;
}

/** Negativo anterior que o lucro desta visita não cobriu — permanece para a próxima coleta. */
export function negativoFicaProximaColetaReais(c: CalculoVisitaResult): number {
  if (c.debitoTotalReais <= 0.009 || c.recuperacaoNegativoReais <= 0.009) return 0;
  return Math.max(0, c.debitoTotalReais - c.recuperacaoNegativoReais);
}

function brlHint(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

/** Valor principal da visita positiva — sempre cobrança do cliente (haver só abate se optar). */
export function resumoTotalVisita(c: CalculoVisitaResult): ResumoTotalVisita {
  const negativoProxima = negativoFicaProximaColetaReais(c);
  const valorCobrar = valorReceberClienteVisitaReais(c);

  return {
    label: negativoProxima > 0.009 ? "Total a cobrar nesta visita" : "Total a cobrar",
    valorReais: valorCobrar,
    hint:
      negativoProxima > 0.009
        ? `${brlHint(negativoProxima)} de negativo anterior ficam para a próxima coleta`
        : c.haverCompensadoReais > 0.009 && valorCobrar <= 0.009
          ? "Operação menor que o haver — cliente não paga (você deve ao ponto)"
          : c.haverCompensadoReais > 0.009
            ? "Descontando haver do ponto"
            : undefined,
    tipo: "cobrar",
  };
}

/**
 * @deprecated Fluxo de “só quitar haver” removido — lucro sempre gera comissão/operação;
 * haver só abate se o operador optar na cobrança. Mantido para compatibilidade (sempre false).
 */
export function somenteQuitarHaver(_c: CalculoVisitaResult): boolean {
  return false;
}

export type ItemCobrancaCliente = {
  label: string;
  valorReais: number;
};

export type ResumoCobrancaCliente = {
  /** Valor a receber do cliente nesta visita (não inclui negativo que fica em aberto). */
  totalACobrarReais: number;
  itens: ItemCobrancaCliente[];
  negativoParaProximaReais: number;
  valorRecebidoReais: number;
  faltaReceberReais: number;
  faltaNegativoReais: number;
  faltaOperacaoReais: number;
  quitado: boolean;
};

/** O que o operador deve receber do cliente nesta visita positiva. */
export function resumoCobrancaCliente(c: CalculoVisitaResult): ResumoCobrancaCliente {
  const temNegativoRecuperado =
    c.debitoTotalReais > 0.009 && c.recuperacaoNegativoReais > 0.009;
  const valorOperacaoCobranca =
    c.valorOperacaoEfetivoReais > 0.009 ? c.valorOperacaoEfetivoReais : c.valorOperacaoReais;
  const negativoParaProximaReais = negativoFicaProximaColetaReais(c);
  const valorReceberHoje = valorReceberClienteVisitaReais(c);

  const itens: ItemCobrancaCliente[] = [];

  if (c.debitoTotalReais > 0.009) {
    if (temNegativoRecuperado) {
      itens.push({
        label: "Devolução do adiantamento",
        valorReais: c.recuperacaoNegativoReais,
      });
    } else {
      itens.push({
        label: "Negativo anterior",
        valorReais: c.debitoTotalReais,
      });
    }
  }

  if (valorOperacaoCobranca > 0.009) {
    itens.push({
      label: "Sua operação",
      valorReais: valorOperacaoCobranca,
    });
  }

  if (c.haverCompensadoReais > 0.009) {
    itens.push({
      label: "− Haver do ponto",
      valorReais: -c.haverCompensadoReais,
    });
  }

  if (c.pendenciaOperacaoIncluidaReais > 0.009) {
    itens.push({
      label: "Pendência anterior",
      valorReais: c.pendenciaOperacaoIncluidaReais,
    });
  }

  const faltaReceberReais = Math.max(0, valorReceberHoje - c.valorPagoReais);
  const quitado =
    faltaReceberReais <= 0.009 &&
    valorReceberHoje > 0.009 &&
    c.valorPagoReais > 0.009;

  return {
    totalACobrarReais: valorReceberHoje,
    itens,
    negativoParaProximaReais,
    valorRecebidoReais: c.valorPagoReais,
    faltaReceberReais,
    faltaNegativoReais: c.debitoRestanteReais,
    faltaOperacaoReais: c.restanteOperacaoReais,
    quitado,
  };
}
