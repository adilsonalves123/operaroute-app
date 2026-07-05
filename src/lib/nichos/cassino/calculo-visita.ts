import { calcularMaquina, calcularTotaisVisita } from "./calculo-maquina";
import { centesimosToReais, reaisToCentesimos } from "./contadores";
import { ajustarArredondamento, distribuirValoresMaquinas } from "./distribuicao";
import {
  calcularAbatimentos,
  calcularBaixasValorPendencia,
  totalDebitoAbertoReais,
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
  const payIds = new Set(pagamento.map((a) => a.pendenciaId));
  return [
    ...operacionais.filter((a) => !payIds.has(a.pendenciaId)),
    ...pagamento,
  ];
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
  const haverTotalReais = totalDebitoAbertoReais(pendenciasHaver);
  const pendenciaOperacaoTotalReais = totalDebitoAbertoReais(pendenciasOperacao);
  const abatimentoAutomaticoPendenciaReais = abaterPendenciaOperacaoNegativa
    ? Math.min(pendenciaOperacaoTotalReais, prejuizoMaquinasReais)
    : 0;

  const valorDeixadoOperadorReais = Math.min(
    Math.max(0, valorDeixadoNoPontoReais),
    Math.max(0, prejuizoMaquinasReais - abatimentoAutomaticoPendenciaReais)
  );
  let restantePrejuizoReais = Math.max(
    0,
    prejuizoMaquinasReais -
      abatimentoAutomaticoPendenciaReais -
      valorDeixadoOperadorReais
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
    valorPagoReais,
    restanteOperacaoReais: 0,
    restanteReais: pendenciaOperacaoRestanteReais,
    haverTotalReais,
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
 * Positiva com haver: lucro compensa haver antes da comissão; operação pode ser zero.
 */
export function calcularVisitaCassino(
  input: CalculoVisitaInput
): CalculoVisitaResult {
  const maquinas = input.leituras.map(calcularMaquina);
  const totais = calcularTotaisVisita(maquinas);
  const debitoTotalReais = totalDebitoAbertoReais(input.pendenciasNegativas);
  const haverPendencias = input.pendenciasHaver ?? [];
  const haverTotalReais = totalDebitoAbertoReais(haverPendencias);
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
  const valorDeixadoOperadorReais = temHaver ? input.descontoManualReais : 0;
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

  const opHaver = input.abaterAutomatico && temHaver
    ? calcularAbatimentos(haverPendencias, saldoAposNegativoCentavos)
    : { abatimentos: [], debitoAbatidoCentavos: 0 };
  const haverCompensadoReais = centesimosToReais(opHaver.debitoAbatidoCentavos);

  const saldoParaComissaoCentavos = Math.max(
    0,
    saldoAposNegativoCentavos - opHaver.debitoAbatidoCentavos
  );

  const comissaoAplicada = saldoParaComissaoCentavos > 0;

  const valorClienteCentavos =
    comissaoAplicada && input.comissaoPercentual > 0
      ? Math.round((saldoParaComissaoCentavos * input.comissaoPercentual) / 100)
      : 0;

  const valorOperacaoCentavos = saldoParaComissaoCentavos - valorClienteCentavos;
  const descontoRecebCentavos = reaisToCentesimos(input.descontoRecebimentoReais);
  const valorOperacaoEfetivoCentavos =
    valorOperacaoCentavos - descontoRecebCentavos;

  const valorClienteReais = centesimosToReais(valorClienteCentavos);
  const valorOperacaoReais = centesimosToReais(valorOperacaoCentavos);
  const valorOperacaoEfetivoReais = centesimosToReais(valorOperacaoEfetivoCentavos);
  const descontoManualReais = centesimosToReais(descontoValCentavos);

  const pendenciasOperacao = input.pendenciasOperacao ?? [];
  const pendenciaOperacaoTotalReais = totalDebitoAbertoReais(pendenciasOperacao);
  const lucroReaisVisita = centesimosToReais(totais.totalLucroCentavos);
  const lucroCobreHaverTotal =
    !temHaver || lucroReaisVisita + 0.009 >= haverTotalReais;
  const incluirPendenciaOperacao =
    lucroCobreHaverTotal &&
    Boolean(input.incluirPendenciasOperacao) &&
    pendenciaOperacaoTotalReais > 0.009;
  const pendenciaOperacaoIncluidaReais = incluirPendenciaOperacao
    ? pendenciaOperacaoTotalReais
    : 0;

  const totalACobrarReais =
    debitoTotalReais + valorOperacaoEfetivoReais + pendenciaOperacaoIncluidaReais;

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

  let saldoPagoClienteCentavos = Math.max(
    0,
    valorPagoClienteCentavos - debitoAbatidoCentavos
  );
  const pagoOperacaoCentavos = Math.min(saldoPagoClienteCentavos, valorOperacaoEfetivoCentavos);
  const valorPagoParaOperacaoReais = centesimosToReais(pagoOperacaoCentavos);
  const restanteOperacaoReais = Math.max(
    0,
    valorOperacaoEfetivoReais - valorPagoParaOperacaoReais
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

  const pendenciasHaverAposVirtual = haverPendencias.map((p) => {
    const ab = opHaver.abatimentos.find((a) => a.pendenciaId === p.id);
    return ab ? { ...p, observacao: ab.observacaoAtualizada } : p;
  });

  // Operador quita haver com o ponto (valor deixado) — não é pagamento do cliente
  const payHaver = calcularAbatimentosPorPagamento(
    pendenciasHaverAposVirtual,
    valorDeixadoOperadorCentavos,
    input.abaterAutomatico
  );
  const haverQuitadoReais = centesimosToReais(payHaver.debitoAbatidoCentavos);
  const abatimentosHaver = mesclarAbatimentos(opHaver.abatimentos, payHaver.abatimentos);

  const haverTotalCentavos = reaisToCentesimos(haverTotalReais);
  const haverAbatidoTotalCentavos =
    opHaver.debitoAbatidoCentavos + payHaver.debitoAbatidoCentavos;
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
    const valorReceberHoje =
      recuperacaoNegativoReais +
      valorOperacaoEfetivoReais +
      pendenciaOperacaoIncluidaReais;
    const faltaCobrancaCliente = Math.max(0, valorReceberHoje - valorPagoClienteReais);
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
    valorPagoReais: valorPagoClienteReais,
    restanteOperacaoReais: restanteOperacaoFinal,
    restanteReais: restanteFinal,
    haverTotalReais,
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
