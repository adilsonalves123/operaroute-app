import { calcularMaquina, calcularTotaisVisita } from "./calculo-maquina";
import { centesimosToReais, reaisToCentesimos } from "./contadores";
import { ajustarArredondamento, distribuirValoresMaquinas } from "./distribuicao";
import {
  calcularAbatimentos,
  calcularBaixasValorPendencia,
  isHaverCreditoComum,
  isHaverDeNegativoCliente,
  totalDebitoAbertoReais,
  totalHaverAbertoReais,
  totalHaverDeNegativoAbertoReais,
} from "./pendencias";
import type {
  CalculoVisitaInput,
  CalculoVisitaResult,
  AbatimentoDebito,
  PendenciaNegativaInput,
} from "./types";

/** Abate pendências com dinheiro (cliente ou operador, conforme o fluxo). */
function calcularAbatimentosPorPagamento(
  pendencias: PendenciaNegativaInput[],
  valorPagoCentavos: number,
  abaterAutomatico: boolean
) {
  if (!abaterAutomatico || pendencias.length === 0 || valorPagoCentavos <= 0) {
    return { abatimentos: [], debitoAbatidoCentavos: 0 };
  }
  return calcularAbatimentos(pendencias, valorPagoCentavos);
}

function mesclarAbatimentos(
  operacionais: AbatimentoDebito[],
  pagamento: AbatimentoDebito[]
): AbatimentoDebito[] {
  const byId = new Map<string, AbatimentoDebito>();
  for (const a of operacionais) {
    byId.set(a.pendenciaId, { ...a });
  }
  for (const a of pagamento) {
    const prev = byId.get(a.pendenciaId);
    if (!prev) {
      byId.set(a.pendenciaId, { ...a });
      continue;
    }
    // Mesma pendência: soma o abatido (desconto na cobrança + pagamento em dinheiro).
    byId.set(a.pendenciaId, {
      ...a,
      valorAbatidoReais: prev.valorAbatidoReais + a.valorAbatidoReais,
      saldoRestanteReais: a.saldoRestanteReais,
      resolvida: a.resolvida,
      observacaoAtualizada: a.observacaoAtualizada,
    });
  }
  return [...byId.values()];
}

function resultadoNegativo(
  maquinas: ReturnType<typeof calcularMaquina>[],
  totais: ReturnType<typeof calcularTotaisVisita>,
  debitoTotalReais: number,
  valorDeixadoNoPontoReais: number,
  pendenciasOperacao: PendenciaNegativaInput[],
  valorPixReais: number,
  valorDinheiroReais: number,
  pendenciasHaver: PendenciaNegativaInput[],
  abaterAutomatico: boolean,
  abaterPendenciaOperacaoNegativa: boolean,
  incluirUsarHaverNegativo: boolean
): CalculoVisitaResult {
  const prejuizoMaquinasReais = centesimosToReais(Math.abs(totais.totalLucroCentavos));
  const haverTotalReais = totalHaverAbertoReais(pendenciasHaver);
  const pendenciaOperacaoTotalReais = totalDebitoAbertoReais(pendenciasOperacao);
  const abatimentoAutomaticoPendenciaReais = abaterPendenciaOperacaoNegativa
    ? Math.min(pendenciaOperacaoTotalReais, prejuizoMaquinasReais)
    : 0;

  const tetoCoberturaPrejuizoReais = Math.max(
    0,
    prejuizoMaquinasReais - abatimentoAutomaticoPendenciaReais
  );
  // Aceita valor acima da perda: o excedente vira pendência (não some no teto).
  const valorDeixadoOperadorReais = Math.max(0, valorDeixadoNoPontoReais);
  const valorAplicadoNoPrejuizoReais = Math.min(
    valorDeixadoOperadorReais,
    tetoCoberturaPrejuizoReais
  );
  const excedenteDeixadoReais = Math.max(
    0,
    valorDeixadoOperadorReais - valorAplicadoNoPrejuizoReais
  );
  let restantePrejuizoReais = Math.max(
    0,
    prejuizoMaquinasReais -
      abatimentoAutomaticoPendenciaReais -
      valorAplicadoNoPrejuizoReais
  );

  const valorPagoReais = abaterPendenciaOperacaoNegativa ? 0 : valorPixReais + valorDinheiroReais;
  const valorPagoCentavos = reaisToCentesimos(valorPagoReais);
  const payPendenciaOperacao =
    abatimentoAutomaticoPendenciaReais > 0.009
      ? calcularBaixasValorPendencia(
          pendenciasOperacao,
          reaisToCentesimos(abatimentoAutomaticoPendenciaReais)
        )
      : pendenciaOperacaoTotalReais > 0.009 && valorPagoCentavos > 0
        ? calcularBaixasValorPendencia(pendenciasOperacao, valorPagoCentavos)
        : { abatimentos: [], abatidoCentavos: 0 };
  const pendenciaOperacaoAbatidaReais = centesimosToReais(
    payPendenciaOperacao.abatidoCentavos
  );
  const pendenciaOperacaoRestanteReais = Math.max(
    0,
    pendenciaOperacaoTotalReais - pendenciaOperacaoAbatidaReais
  );

  let haverCompensadoReais = 0;
  let abatimentosHaver: AbatimentoDebito[] = [];
  if (
    incluirUsarHaverNegativo &&
    restantePrejuizoReais > 0.009 &&
    haverTotalReais > 0.009 &&
    abaterAutomatico
  ) {
    const opHaver = calcularAbatimentos(
      pendenciasHaver,
      reaisToCentesimos(restantePrejuizoReais)
    );
    haverCompensadoReais = centesimosToReais(opHaver.debitoAbatidoCentavos);
    abatimentosHaver = opHaver.abatimentos;
    restantePrejuizoReais = Math.max(0, restantePrejuizoReais - haverCompensadoReais);
  }

  const haverGeradoReais = restantePrejuizoReais;
  const clientePagouGanhadores = haverGeradoReais > 0.009;
  const haverAbatidoCentavos = reaisToCentesimos(haverCompensadoReais);
  const haverRestanteReais = centesimosToReais(
    Math.max(0, reaisToCentesimos(haverTotalReais) - haverAbatidoCentavos)
  );

  /** Total financiado pelo operador nesta visita — recupera inteiro nas positivas. */
  const novoDebitoReais = Math.max(
    0,
    prejuizoMaquinasReais - haverGeradoReais - haverCompensadoReais
  );

  const saldoLiquidoReais =
    valorDeixadoOperadorReais > 0.009
      ? pendenciaOperacaoAbatidaReais + valorDeixadoOperadorReais + haverGeradoReais
      : abaterPendenciaOperacaoNegativa
        ? pendenciaOperacaoRestanteReais - haverGeradoReais
        : pendenciaOperacaoAbatidaReais - haverGeradoReais;

  return {
    maquinas,
    totalEntradaPeriodo: totais.totalEntradaPeriodo,
    totalSaidaPeriodo: totais.totalSaidaPeriodo,
    totalLucroCentavos: totais.totalLucroCentavos,
    saldoNegativo: true,
    debitoTotalReais,
    recuperacaoNegativoReais: 0,
    debitoAbatidoReais: 0,
    debitoRestanteReais: debitoTotalReais,
    abatimentos: [],
    descontoManualReais: valorDeixadoOperadorReais,
    saldoAposDebitoReais: 0,
    saldoAposDescontoReais: 0,
    valorClienteReais: 0,
    valorOperacaoReais: 0,
    descontoRecebimentoReais: 0,
    valorOperacaoEfetivoReais: 0,
    totalACobrarReais: 0,
    pendenciaOperacaoTotalReais,
    pendenciaOperacaoIncluidaReais: 0,
    pendenciaOperacaoAbatidaReais,
    pendenciaOperacaoRestanteReais,
    abatimentosPendenciaOperacao: payPendenciaOperacao.abatimentos,
    valorDeixadoOperadorReais,
    excedenteDeixadoReais,
    valorPagoReais,
    restanteOperacaoReais: 0,
    restanteReais: pendenciaOperacaoRestanteReais,
    haverTotalReais,
    haverDeNegativoTotalReais: 0,
    recuperacaoHaverDeNegativoReais: 0,
    haverCompensadoReais,
    haverQuitadoReais: 0,
    haverRestanteReais,
    abatimentosHaver,
    haverReais: 0,
    haverGeradoReais,
    clientePagouGanhadores,
    novoDebitoReais,
    saldoLiquidoReais,
    maquinasDistribuidas: maquinas.map((m) => ({
      ...m,
      valorClienteReais: 0,
      valorOperacaoReais: 0,
      descontoReais: 0,
      restanteReais: 0,
    })),
    comissaoAplicada: false,
  };
}

/**
 * Cadeia financeira da visita cassino.
 * Negativo: operador deixa dinheiro → débito; cliente paga → haver.
 * Positiva: comissão sobre o lucro; haver só abate na cobrança se o operador optar.
 */
export function calcularVisitaCassino(
  input: CalculoVisitaInput
): CalculoVisitaResult {
  const maquinas = input.leituras.map(calcularMaquina);
  const totais = calcularTotaisVisita(maquinas);
  const debitoTotalReais = totalDebitoAbertoReais(input.pendenciasNegativas);
  const haverPendencias = input.pendenciasHaver ?? [];
  const haverTotalReais = totalHaverAbertoReais(haverPendencias);
  const temHaver = haverTotalReais > 0.009;
  const temNegativo = debitoTotalReais > 0.009;

  if (totais.totalLucroCentavos < 0) {
    return resultadoNegativo(
      maquinas,
      totais,
      debitoTotalReais,
      input.descontoManualReais,
      input.pendenciasOperacao ?? [],
      input.valorPixReais ?? 0,
      input.valorDinheiroReais ?? 0,
      input.pendenciasHaver ?? [],
      input.abaterAutomatico,
      input.abaterPendenciaOperacaoNegativa !== false,
      Boolean(input.incluirUsarHaverNegativo)
    );
  }

  const valorPix = input.valorPixReais ?? 0;
  const valorDinheiro = input.valorDinheiroReais ?? 0;
  const valorPagoClienteReais = valorPix + valorDinheiro;
  const valorPagoClienteCentavos = reaisToCentesimos(valorPagoClienteReais);
  const haverDeNegativoPendencias = haverPendencias.filter(isHaverDeNegativoCliente);
  const haverCreditoPendencias = haverPendencias.filter(isHaverCreditoComum);
  const temHaverCredito = totalHaverAbertoReais(haverCreditoPendencias) > 0.009;
  /** Só deixa dinheiro para quitar crédito (troco). Haver de ganhadores zera no lucro. */
  const valorDeixadoOperadorReais = temHaverCredito ? input.descontoManualReais : 0;
  const valorDeixadoOperadorCentavos = reaisToCentesimos(valorDeixadoOperadorReais);

  const descontoManualCentavos = reaisToCentesimos(
    temNegativo || temHaver ? 0 : input.descontoManualReais
  );
  const descontoValCentavos = Math.min(
    descontoManualCentavos,
    Math.max(0, totais.totalLucroCentavos)
  );
  const saldoAposDescontoCentavos = totais.totalLucroCentavos - descontoValCentavos;

  const opNegativoLucro =
    input.abaterAutomatico && temNegativo
      ? calcularAbatimentos(input.pendenciasNegativas, saldoAposDescontoCentavos)
      : { abatimentos: [], debitoAbatidoCentavos: 0 };
  const recuperacaoNegativoReais = centesimosToReais(opNegativoLucro.debitoAbatidoCentavos);

  const saldoAposNegativoCentavos = Math.max(
    0,
    saldoAposDescontoCentavos - opNegativoLucro.debitoAbatidoCentavos
  );

  /**
   * Haver de “cliente pagou ganhadores” bloqueia comissão como negativo
   * e é baixado automaticamente pelo lucro (não entra em descontar/pagar).
   */
  const haverDeNegativoTotalReais = totalHaverDeNegativoAbertoReais(haverPendencias);
  const buracoHaverDeNegativoCentavos = Math.min(
    reaisToCentesimos(haverDeNegativoTotalReais),
    saldoAposNegativoCentavos
  );
  const recuperacaoHaverDeNegativoReais = centesimosToReais(
    buracoHaverDeNegativoCentavos
  );
  const opHaverDeNegativoLucro =
    input.abaterAutomatico && buracoHaverDeNegativoCentavos > 0
      ? calcularAbatimentos(haverDeNegativoPendencias, buracoHaverDeNegativoCentavos)
      : { abatimentos: [], debitoAbatidoCentavos: 0 };

  /** Comissão só no lucro após negativo e após haver-de-negativo. */
  const saldoParaComissaoCentavos = Math.max(
    0,
    saldoAposNegativoCentavos - buracoHaverDeNegativoCentavos
  );
  const lucroDisponivelParaOperacaoCentavos = saldoParaComissaoCentavos;

  const comissaoAplicada = lucroDisponivelParaOperacaoCentavos > 0;

  const valorClienteBrutoCentavos =
    comissaoAplicada && input.comissaoPercentual > 0
      ? Math.round((saldoParaComissaoCentavos * input.comissaoPercentual) / 100)
      : 0;
  const valorClienteCentavos = Math.min(
    valorClienteBrutoCentavos,
    lucroDisponivelParaOperacaoCentavos
  );

  const valorOperacaoCentavos = Math.max(
    0,
    lucroDisponivelParaOperacaoCentavos - valorClienteCentavos
  );
  const descontoRecebCentavos = reaisToCentesimos(input.descontoRecebimentoReais);
  const valorOperacaoEfetivoCentavos =
    valorOperacaoCentavos - descontoRecebCentavos;

  const valorClienteReais = centesimosToReais(valorClienteCentavos);
  const valorOperacaoReais = centesimosToReais(valorOperacaoCentavos);
  const valorOperacaoEfetivoReais = centesimosToReais(valorOperacaoEfetivoCentavos);
  const descontoManualReais = centesimosToReais(descontoValCentavos);

  const pendenciasOperacao = input.pendenciasOperacao ?? [];
  const pendenciaOperacaoTotalReais = totalDebitoAbertoReais(pendenciasOperacao);
  const incluirPendenciaOperacao =
    Boolean(input.incluirPendenciasOperacao) &&
    pendenciaOperacaoTotalReais > 0.009;
  const pendenciaOperacaoIncluidaReais = incluirPendenciaOperacao
    ? pendenciaOperacaoTotalReais
    : 0;

  const totalAntesHaverReais =
    debitoTotalReais + valorOperacaoEfetivoReais + pendenciaOperacaoIncluidaReais;

  // Descontar na cobrança: só crédito (troco/a mais). Haver de ganhadores já foi no lucro.
  const opHaverCobranca =
    Boolean(input.descontarHaverNaCobranca) &&
    temHaverCredito &&
    input.abaterAutomatico
      ? calcularAbatimentos(
          haverCreditoPendencias,
          reaisToCentesimos(totalAntesHaverReais)
        )
      : { abatimentos: [], debitoAbatidoCentavos: 0 };

  const haverCompensadoReais = centesimosToReais(opHaverCobranca.debitoAbatidoCentavos);

  const totalACobrarReais = Math.max(
    0,
    totalAntesHaverReais - centesimosToReais(opHaverCobranca.debitoAbatidoCentavos)
  );

  const opHaver = {
    abatimentos: opHaverCobranca.abatimentos,
    debitoAbatidoCentavos: opHaverCobranca.debitoAbatidoCentavos,
  };

  // Cliente paga: negativo → operação
  const { abatimentos, debitoAbatidoCentavos } = calcularAbatimentosPorPagamento(
    input.pendenciasNegativas,
    valorPagoClienteCentavos,
    input.abaterAutomatico
  );
  const debitoAbatidoReais = centesimosToReais(debitoAbatidoCentavos);
  const debitoRestanteCentavos = Math.max(
    0,
    reaisToCentesimos(debitoTotalReais) - debitoAbatidoCentavos
  );
  const debitoRestanteReais = centesimosToReais(debitoRestanteCentavos);

  const haverDescontadoNaCobrancaReais = centesimosToReais(
    opHaverCobranca.debitoAbatidoCentavos
  );
  const haverAbateOperacaoReais = Math.min(
    haverDescontadoNaCobrancaReais,
    valorOperacaoEfetivoReais
  );
  const valorOperacaoDevidoNaCobrancaReais = Math.max(
    0,
    valorOperacaoEfetivoReais - haverAbateOperacaoReais
  );
  const valorOperacaoDevidoCentavos = reaisToCentesimos(
    valorOperacaoDevidoNaCobrancaReais
  );

  let saldoPagoClienteCentavos = Math.max(
    0,
    valorPagoClienteCentavos - debitoAbatidoCentavos
  );
  const pagoOperacaoCentavos = Math.min(
    saldoPagoClienteCentavos,
    valorOperacaoDevidoCentavos
  );
  const valorPagoParaOperacaoReais = centesimosToReais(pagoOperacaoCentavos);
  const restanteOperacaoReais = Math.max(
    0,
    valorOperacaoDevidoNaCobrancaReais - valorPagoParaOperacaoReais
  );

  saldoPagoClienteCentavos = Math.max(
    0,
    saldoPagoClienteCentavos - pagoOperacaoCentavos
  );

  const payPendenciaOperacao =
    pendenciaOperacaoTotalReais > 0.009 && saldoPagoClienteCentavos > 0
      ? calcularBaixasValorPendencia(pendenciasOperacao, saldoPagoClienteCentavos)
      : { abatimentos: [], abatidoCentavos: 0 };
  const pendenciaOperacaoAbatidaReais = centesimosToReais(
    payPendenciaOperacao.abatidoCentavos
  );
  const pendenciaOperacaoRestanteReais = Math.max(
    0,
    pendenciaOperacaoTotalReais - pendenciaOperacaoAbatidaReais
  );

  saldoPagoClienteCentavos = Math.max(
    0,
    saldoPagoClienteCentavos - payPendenciaOperacao.abatidoCentavos
  );

  const pendenciasHaverAposVirtual = haverCreditoPendencias.map((p) => {
    const ab = opHaver.abatimentos.find((a) => a.pendenciaId === p.id);
    return ab ? { ...p, observacao: ab.observacaoAtualizada } : p;
  });

  // Operador quita só crédito (troco) com o ponto — não é pagamento do cliente
  const payHaver = calcularAbatimentosPorPagamento(
    pendenciasHaverAposVirtual,
    valorDeixadoOperadorCentavos,
    input.abaterAutomatico
  );
  const haverQuitadoReais = centesimosToReais(payHaver.debitoAbatidoCentavos);
  const abatimentosHaver = mesclarAbatimentos(
    mesclarAbatimentos(opHaverDeNegativoLucro.abatimentos, opHaver.abatimentos),
    payHaver.abatimentos
  );

  const haverTotalCentavos = reaisToCentesimos(haverTotalReais);
  const haverAbatidoTotalCentavos =
    opHaverDeNegativoLucro.debitoAbatidoCentavos +
    opHaver.debitoAbatidoCentavos +
    payHaver.debitoAbatidoCentavos;
  const haverRestanteCentavos = Math.max(0, haverTotalCentavos - haverAbatidoTotalCentavos);
  const haverRestanteReais = centesimosToReais(haverRestanteCentavos);

  const haverReais = centesimosToReais(saldoPagoClienteCentavos);
  const restanteReais = Math.max(0, totalACobrarReais - valorPagoClienteReais);

  /** Lucro cobriu todo o negativo — falta de pagamento vira dívida da operação, não negativo em aberto. */
  const negativoQuitadoPorLucro =
    debitoTotalReais > 0.009 &&
    recuperacaoNegativoReais + 0.009 >= debitoTotalReais;

  let abatimentosNegativoFinal = abatimentos;
  let debitoRestanteFinal = debitoRestanteReais;
  let debitoAbatidoFinal = debitoAbatidoReais;
  let restanteOperacaoFinal = restanteOperacaoReais;
  let restanteFinal = restanteReais;

  if (negativoQuitadoPorLucro) {
    abatimentosNegativoFinal = opNegativoLucro.abatimentos;
    debitoRestanteFinal = 0;
    debitoAbatidoFinal = 0;
    // Cobrança desta visita (negativo recuperado + operação − haver), sem
    // reempacotar pendências antigas — elas ficam nas linhas próprias.
    const faltaCobrancaCliente = Math.max(
      0,
      totalACobrarReais -
        pendenciaOperacaoIncluidaReais -
        valorPagoClienteReais
    );
    restanteOperacaoFinal = faltaCobrancaCliente;
    restanteFinal = faltaCobrancaCliente;
  }

  let maquinasDistribuidas = distribuirValoresMaquinas(
    maquinas,
    valorClienteReais,
    valorOperacaoReais,
    descontoManualReais,
    restanteOperacaoFinal
  );

  maquinasDistribuidas = ajustarArredondamento(maquinasDistribuidas, {
    valorClienteReais,
    valorOperacaoReais,
    restanteReais: restanteOperacaoFinal,
  });

  return {
    maquinas,
    totalEntradaPeriodo: totais.totalEntradaPeriodo,
    totalSaidaPeriodo: totais.totalSaidaPeriodo,
    totalLucroCentavos: totais.totalLucroCentavos,
    saldoNegativo: false,
    debitoTotalReais,
    recuperacaoNegativoReais,
    debitoAbatidoReais: debitoAbatidoFinal,
    debitoRestanteReais: debitoRestanteFinal,
    abatimentos: abatimentosNegativoFinal,
    descontoManualReais,
    saldoAposDebitoReais: centesimosToReais(saldoParaComissaoCentavos),
    saldoAposDescontoReais: centesimosToReais(saldoAposDescontoCentavos),
    valorClienteReais,
    valorOperacaoReais,
    descontoRecebimentoReais: input.descontoRecebimentoReais,
    valorOperacaoEfetivoReais,
    totalACobrarReais,
    pendenciaOperacaoTotalReais,
    pendenciaOperacaoIncluidaReais,
    pendenciaOperacaoAbatidaReais,
    pendenciaOperacaoRestanteReais,
    abatimentosPendenciaOperacao: payPendenciaOperacao.abatimentos,
    valorDeixadoOperadorReais,
    excedenteDeixadoReais: 0,
    valorPagoReais: valorPagoClienteReais,
    restanteOperacaoReais: restanteOperacaoFinal,
    restanteReais: restanteFinal,
    haverTotalReais,
    haverDeNegativoTotalReais,
    recuperacaoHaverDeNegativoReais,
    haverCompensadoReais,
    haverQuitadoReais,
    haverRestanteReais,
    abatimentosHaver,
    haverReais,
    haverGeradoReais: 0,
    clientePagouGanhadores: false,
    novoDebitoReais: 0,
    saldoLiquidoReais: 0,
    maquinasDistribuidas,
    comissaoAplicada,
  };
}
