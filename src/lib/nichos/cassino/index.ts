export { calcularVisitaCassino } from "./calculo-visita";
export { calcularMaquina, calcularTotaisVisita } from "./calculo-maquina";
export {
  centesimosToReais,
  reaisToCentesimos,
  formatContador,
  formatContadorInput,
  parseContadorInput,
  validarLeitura,
} from "./contadores";
export {
  extrairTotalAbatido,
  saldoPendenciaReais,
  saldoPendenciaCobravel,
  isPendenciaOperacao,
  totalDebitoAbertoReais,
  calcularAbatimentos,
  calcularBaixasValorPendencia,
} from "./pendencias";
export {
  distribuirValoresMaquinas,
  ajustarArredondamento,
  lucroMaquinaReais,
} from "./distribuicao";
export type {
  LeituraMaquinaInput,
  MaquinaCalculo,
  CalculoVisitaInput,
  CalculoVisitaResult,
  PendenciaNegativaInput,
  AbatimentoDebito,
  MaquinaDistribuida,
} from "./types";
export type { RelatorioColetaData, AdiantamentoDetalhe } from "./relatorio";
export {
  buildRelatorioMensagemWhatsApp,
  buildResumoFinanceiroLinhas,
  hintAdiantamento,
  valorSaidaCaixaAdiantamento,
  whatsAppUrl,
  downloadBlob,
} from "./relatorio";
export { captureElementAsPng } from "./capture-relatorio";
export { resumoTotalVisita, somenteQuitarHaver, resumoOperacaoNegativa, displayOperacaoNegativa, resumoCobrancaCliente } from "./resumo-visita";
export { reconstructCalculoNegativoFromVisita, reconstructCalculoPositivoFromVisita } from "./reconstruct-visita";
export type { VisitaHistoricoRecord, PendenciaHistoricoRecord } from "./reconstruct-visita";
export type { ResumoTotalVisita, ResumoOperacaoNegativa, LinhaQuemPagouNegativo, DisplayOperacaoNegativa, ResumoCobrancaCliente, ItemCobrancaCliente } from "./resumo-visita";
export {
  hintMovimentoCaixa,
  valorMovimentoCaixa,
  valorForaCaixa,
} from "./caixa";
export type { MovimentoCaixaDetalhe } from "./caixa";
export {
  parseComissaoPercentual,
  baseComissaoReais,
  comissaoBloqueada,
} from "./comissao";
