/** Contadores de máquina — sempre inteiros (centésimos do visor) */
export interface LeituraMaquinaInput {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtual: number;
  saidaAtual: number;
  fotoUri?: string | null;
}

export interface MaquinaCalculo {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtual: number;
  saidaAtual: number;
  entradaPeriodo: number;
  saidaPeriodo: number;
  lucroCentavos: number;
  fotoUri?: string | null;
}

export interface PendenciaNegativaInput {
  id: string;
  valor: number;
  observacao?: string | null;
}

export interface AbatimentoDebito {
  pendenciaId: string;
  valorAbatidoReais: number;
  saldoRestanteReais: number;
  observacaoAtualizada: string;
  resolvida: boolean;
}

/** Baixa em pendência cujo saldo é o campo valor (pagamento_pendente / parcial). */
export interface BaixaPendenciaValor {
  pendenciaId: string;
  valorAbatidoReais: number;
  valorRestanteReais: number;
  descricaoAtualizada: string;
  resolvida: boolean;
}

export interface CalculoVisitaInput {
  leituras: LeituraMaquinaInput[];
  pendenciasNegativas: PendenciaNegativaInput[];
  pendenciasHaver?: PendenciaNegativaInput[];
  /** Pagamentos pendentes de coletas anteriores (parcial / pagamento_pendente) */
  pendenciasOperacao?: PendenciaNegativaInput[];
  incluirPendenciasOperacao?: boolean;
  /** Visita negativa: recebimento de hoje pode ou nao baixar a pendencia anterior */
  abaterPendenciaOperacaoNegativa?: boolean;
  /** Visita negativa: abater haver existente antes de gerar novo haver */
  incluirUsarHaverNegativo?: boolean;
  comissaoPercentual: number;
  descontoManualReais: number;
  descontoRecebimentoReais: number;
  abaterAutomatico: boolean;
  valorPixReais?: number;
  valorDinheiroReais?: number;
}

export interface MaquinaDistribuida extends MaquinaCalculo {
  valorClienteReais: number;
  valorOperacaoReais: number;
  descontoReais: number;
  restanteReais: number;
}

export interface CalculoVisitaResult {
  maquinas: MaquinaCalculo[];
  totalEntradaPeriodo: number;
  totalSaidaPeriodo: number;
  totalLucroCentavos: number;
  saldoNegativo: boolean;
  debitoTotalReais: number;
  /** Quanto do lucro desta visita vai para recuperar o negativo (base da comissão) */
  recuperacaoNegativoReais: number;
  /** Quanto do negativo foi quitado em dinheiro nesta visita */
  debitoAbatidoReais: number;
  debitoRestanteReais: number;
  abatimentos: AbatimentoDebito[];
  descontoManualReais: number;
  saldoAposDebitoReais: number;
  saldoAposDescontoReais: number;
  valorClienteReais: number;
  valorOperacaoReais: number;
  descontoRecebimentoReais: number;
  valorOperacaoEfetivoReais: number;
  /** Negativo + operação que o cliente deve pagar nesta visita */
  totalACobrarReais: number;
  /** Total de pendências de operação em aberto no ponto */
  pendenciaOperacaoTotalReais: number;
  /** Pendência anterior somada ao total a cobrar */
  pendenciaOperacaoIncluidaReais: number;
  pendenciaOperacaoAbatidaReais: number;
  pendenciaOperacaoRestanteReais: number;
  abatimentosPendenciaOperacao: BaixaPendenciaValor[];
  /** Quanto o operador deixou no ponto (quitar haver ou visita negativa) */
  valorDeixadoOperadorReais: number;
  /** Pago pelo cliente (Pix + dinheiro) */
  valorPagoReais: number;
  /** Dívida da operação ainda não paga (vira pagamento_pendente) */
  restanteOperacaoReais: number;
  /** Total em aberto após pagamento (negativo + operação) */
  restanteReais: number;
  /** Haver aberto antes da visita (cliente pagou ganhadores em visita negativa anterior) */
  haverTotalReais: number;
  /** Lucro da visita usado para compensar haver (sem dinheiro) */
  haverCompensadoReais: number;
  /** Haver quitado em dinheiro nesta visita (inclui valor deixado no ponto) */
  haverQuitadoReais: number;
  haverRestanteReais: number;
  abatimentosHaver: AbatimentoDebito[];
  /** Pagamento a maior na visita positiva — novo crédito do cliente */
  haverReais: number;
  /** Visita negativa: cliente pagou ganhadores — gera haver */
  haverGeradoReais: number;
  clientePagouGanhadores: boolean;
  novoDebitoReais: number;
  /** Visita negativa: quanto o ponto ainda deve ao operador neste acerto. */
  saldoLiquidoReais: number;
  maquinasDistribuidas: MaquinaDistribuida[];
  comissaoAplicada: boolean;
}
