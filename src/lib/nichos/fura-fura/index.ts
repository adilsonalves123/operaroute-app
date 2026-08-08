export { calcularColetaFuraFura } from "./calculo-coleta";
export type { BrindeEntregue, CalculoColetaFuraFuraInput, CalculoColetaFuraFuraResult } from "./calculo-coleta";
export { resumoColetaFuraFura, mensagemWhatsAppColeta } from "./resumo-coleta";
export {
  alertasPontoFura,
  diasDesdeColeta,
  DIAS_SEM_COLETA_ALERTA,
  prioridadeRotaPonto,
  type AlertaPontoFura,
} from "./alertas-ponto";
export { linksNavegacaoPonto } from "./navegacao";
export {
  calculoFromColetaSalva,
  parseBrindesSalvos,
  deltaPercentual,
  type ComparativoMes,
} from "./reconstruct-coleta";
export {
  distribuirPagamentoFifo,
  saldoPendenteColeta,
} from "./pagamentos-fifo";
export type { ColetaPendente, DistribuicaoPagamento } from "./pagamentos-fifo";
export {
  agregarPendenciasPorPonto,
  labelPontoComPendencia,
  isHaverFuraFura,
  somarHaverFuraFuraAberto,
  type ResumoPendenciaPonto,
  type ColetaSaldoPonto,
} from "./pendencia-ponto";
export {
  validarBrindesContraEstoquePonto,
  quantidadeRestanteBrindeNoPonto,
  maxQuantidadeLinhaBrinde,
  type EstoqueBrindePonto,
} from "./validar-brindes-estoque";
export {
  validarQuantidadeFurosColeta,
  maxFurosColetaPermitidos,
} from "./validar-furos-coleta";
export { parseRecebimentoPixDinheiro, type RecebimentoPixDinheiro } from "./recebimento-pagamento";
export { calcularRecebimentoComPendencia, type RecebimentoComPendencia } from "./recebimento-pendencia";
export { aplicarPagamentoFifoColetas } from "./aplicar-pagamento-fifo";
export { registrarHaverFuraFura, splitExcedentePagamento } from "./haver-ponto";

export const NICHO_MODULO_FURA_FURA = "fura_fura";
