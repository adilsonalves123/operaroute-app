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

export const NICHO_MODULO_FURA_FURA = "fura_fura";
