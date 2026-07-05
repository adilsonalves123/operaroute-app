import { centesimosToReais } from "./contadores";
import { isPendenciaOperacao } from "./pendencias";
import type { CalculoVisitaResult } from "./types";

const BAIXA_LINE_REGEX = /Baixa de R\$ ([\d.,]+)/;
const ABATIDO_LINE_REGEX = /Abatido R\$ ([\d.,]+)/;

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function extractBaixaOperacaoVisita(
  pendencias: PendenciaHistoricoRecord[],
  visitaId: string,
  dataVisita: Date
): { abatida: number; restante: number } {
  const dataStr = dataVisita.toLocaleDateString("pt-BR");
  let abatida = 0;
  let restante = 0;

  for (const p of pendencias) {
    if (!isPendenciaOperacao(p.tipo) || !p.descricao) continue;

    const marcadaVisita = p.descricao.includes(`[visita:${visitaId}]`);
    if (!marcadaVisita) continue;

    for (const linha of p.descricao.split("\n")) {
      if (!BAIXA_LINE_REGEX.test(linha)) continue;
      if (!linha.includes(`na coleta de ${dataStr}`) && !linha.includes(`[visita:${visitaId}]`)) {
        continue;
      }
      const match = linha.match(BAIXA_LINE_REGEX);
      if (match) abatida += parseValorBR(match[1]);
    }

    restante += Math.max(0, Number(p.valor ?? 0));
  }

  return { abatida, restante };
}

export type VisitaHistoricoRecord = {
  id: string;
  created_at: string;
  total_lucro_centavos: number;
  total_entrada_periodo: number;
  total_saida_periodo: number;
  desconto: number;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
  valor_pago?: number | null;
  restante?: number | null;
  valor_cliente?: number | null;
  valor_operacao?: number | null;
  valor_operacao_efetivo?: number | null;
  desconto_recebimento?: number | null;
  debito_abatido?: number | null;
};

export type PendenciaHistoricoRecord = {
  id: string;
  tipo: string;
  valor: number | null;
  descricao: string | null;
  visita_id?: string | null;
};

/** Reconstrói o resultado do cálculo para exibir histórico de visitas negativas. */
export function reconstructCalculoNegativoFromVisita(
  visita: VisitaHistoricoRecord,
  pendencias: PendenciaHistoricoRecord[]
): CalculoVisitaResult {
  const visitaId = visita.id;
  const dataVisita = new Date(visita.created_at);
  const prejuizoReais = Math.abs(Number(visita.total_lucro_centavos)) / 100;
  const valorDeixadoOperadorReais = Math.max(0, Number(visita.desconto ?? 0));
  const valorPagoReais = Number(visita.valor_pago ?? 0);

  const { abatida: pendenciaOperacaoAbatidaReais, restante: pendenciaOperacaoRestanteReais } =
    extractBaixaOperacaoVisita(pendencias, visitaId, dataVisita);

  const dataStr = dataVisita.toLocaleDateString("pt-BR");

  let haverCompensadoReais = 0;
  for (const p of pendencias) {
    if (p.tipo.toLowerCase() !== "haver" || !p.descricao) continue;
    if (!p.descricao.includes(`[visita:${visitaId}]`)) continue;
    for (const linha of p.descricao.split("\n")) {
      if (!ABATIDO_LINE_REGEX.test(linha)) continue;
      if (!linha.includes(`na coleta de ${dataStr}`) && !linha.includes(`[visita:${visitaId}]`)) {
        continue;
      }
      const match = linha.match(ABATIDO_LINE_REGEX);
      if (match) haverCompensadoReais += parseValorBR(match[1]);
    }
  }

  let debitoAbatidoNegativoReais = 0;
  for (const p of pendencias) {
    if (p.tipo.toLowerCase() !== "negativo" || !p.descricao) continue;
    if (!p.descricao.includes(`[visita:${visitaId}]`)) continue;
    for (const linha of p.descricao.split("\n")) {
      if (!ABATIDO_LINE_REGEX.test(linha)) continue;
      if (!linha.includes(`na coleta de ${dataStr}`) && !linha.includes(`[visita:${visitaId}]`)) {
        continue;
      }
      const match = linha.match(ABATIDO_LINE_REGEX);
      if (match) debitoAbatidoNegativoReais += parseValorBR(match[1]);
    }
  }

  const negativoCriado = pendencias.find(
    (p) => p.visita_id === visitaId && p.tipo.toLowerCase() === "negativo"
  );
  const haverCriado = pendencias.find(
    (p) => p.visita_id === visitaId && p.tipo.toLowerCase() === "haver"
  );

  let haverGeradoReais = haverCriado ? Math.max(0, Number(haverCriado.valor ?? 0)) : 0;
  if (haverGeradoReais <= 0.009) {
    haverGeradoReais = Math.max(
      0,
      prejuizoReais -
        pendenciaOperacaoAbatidaReais -
        valorDeixadoOperadorReais -
        haverCompensadoReais
    );
  }

  let pendenciaOperacaoAbatidaFinal = pendenciaOperacaoAbatidaReais;
  if (pendenciaOperacaoAbatidaFinal <= 0.009 && valorDeixadoOperadorReais > 0.009) {
    const inferida = Math.max(
      0,
      prejuizoReais - valorDeixadoOperadorReais - haverGeradoReais - haverCompensadoReais
    );
    if (inferida > 0.009) pendenciaOperacaoAbatidaFinal = inferida;
  }

  const pendenciaOperacaoTotalFinal =
    pendenciaOperacaoAbatidaFinal + pendenciaOperacaoRestanteReais;

  let novoDebitoReais = negativoCriado ? Math.max(0, Number(negativoCriado.valor ?? 0)) : 0;
  if (novoDebitoReais <= 0.009) {
    novoDebitoReais = Math.max(0, prejuizoReais - haverGeradoReais - haverCompensadoReais);
  }

  const operatorRepostou = valorDeixadoOperadorReais > 0.009;
  const abaterPendenciaOperacaoNegativa =
    !operatorRepostou &&
    valorPagoReais <= 0.009 &&
    Number(visita.valor_pix ?? 0) <= 0.009 &&
    Number(visita.valor_dinheiro ?? 0) <= 0.009 &&
    pendenciaOperacaoRestanteReais > 0.009;
  const saldoLiquidoReais = operatorRepostou
    ? pendenciaOperacaoAbatidaFinal + valorDeixadoOperadorReais + haverGeradoReais
    : abaterPendenciaOperacaoNegativa
      ? pendenciaOperacaoRestanteReais - haverGeradoReais
      : pendenciaOperacaoAbatidaFinal - haverGeradoReais;

  const debitoTotalReais = debitoAbatidoNegativoReais;

  return {
    maquinas: [],
    totalEntradaPeriodo: Number(visita.total_entrada_periodo ?? 0),
    totalSaidaPeriodo: Number(visita.total_saida_periodo ?? 0),
    totalLucroCentavos: Number(visita.total_lucro_centavos),
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
    pendenciaOperacaoTotalReais: pendenciaOperacaoTotalFinal,
    pendenciaOperacaoIncluidaReais: 0,
    pendenciaOperacaoAbatidaReais: pendenciaOperacaoAbatidaFinal,
    pendenciaOperacaoRestanteReais,
    abatimentosPendenciaOperacao: [],
    valorDeixadoOperadorReais,
    valorPagoReais,
    restanteOperacaoReais: 0,
    restanteReais: Number(visita.restante ?? pendenciaOperacaoRestanteReais),
    haverTotalReais: 0,
    haverCompensadoReais,
    haverQuitadoReais: 0,
    haverRestanteReais: 0,
    abatimentosHaver: [],
    haverReais: 0,
    haverGeradoReais,
    clientePagouGanhadores: haverGeradoReais > 0.009,
    novoDebitoReais,
    saldoLiquidoReais,
    maquinasDistribuidas: [],
    comissaoAplicada: false,
  };
}

/** Reconstrói o cálculo para exibir histórico de visitas positivas com composição do total. */
export function reconstructCalculoPositivoFromVisita(
  visita: VisitaHistoricoRecord,
  pendencias: PendenciaHistoricoRecord[]
): CalculoVisitaResult {
  const dataVisita = new Date(visita.created_at);
  const valorCliente = Number(visita.valor_cliente ?? 0);
  const valorOperacao = Number(visita.valor_operacao ?? 0);
  const valorOperacaoEfetivo = Number(visita.valor_operacao_efetivo ?? 0);
  const valorPago = Number(visita.valor_pago ?? 0);
  const descontoManual = Number(visita.desconto ?? 0);
  const descontoRecebimento = Number(visita.desconto_recebimento ?? 0);
  const debitoAbatido = Number(visita.debito_abatido ?? 0);
  const lucroReais = centesimosToReais(Number(visita.total_lucro_centavos));
  const saldoAposDesconto = lucroReais - descontoManual;
  const saldoAposDebito = valorCliente + valorOperacao;
  const recuperacaoNegativo = Math.max(0, saldoAposDesconto - saldoAposDebito);

  const { abatida: pendenciaOperacaoAbatidaReais, restante: pendenciaOperacaoRestanteReais } =
    extractBaixaOperacaoVisita(pendencias, visita.id, dataVisita);

  const operacaoMarcada = pendencias.some(
    (p) => isPendenciaOperacao(p.tipo) && p.descricao?.includes(`[visita:${visita.id}]`)
  );

  const pendenciaOperacaoTotalReais =
    pendenciaOperacaoAbatidaReais + pendenciaOperacaoRestanteReais;
  const pendenciaOperacaoIncluidaReais =
    operacaoMarcada || pendenciaOperacaoAbatidaReais > 0.009 ? pendenciaOperacaoTotalReais : 0;

  const totalACobrar =
    valorPago + Math.max(0, Number(visita.restante ?? 0)) > 0.009
      ? valorPago + Math.max(0, Number(visita.restante ?? 0))
      : Math.max(0, valorOperacaoEfetivo + pendenciaOperacaoIncluidaReais);

  const debitoTotalReais = Math.max(
    0,
    totalACobrar - valorOperacaoEfetivo - pendenciaOperacaoIncluidaReais
  );
  const debitoRestanteReais = Math.max(0, debitoTotalReais - debitoAbatido);
  const valorPagoParaOperacao = Math.max(0, valorPago - debitoAbatido);
  const restanteOperacaoReais = Math.max(0, valorOperacaoEfetivo - valorPagoParaOperacao);
  const restanteReais = Math.max(0, Number(visita.restante ?? totalACobrar - valorPago));
  const haverReais = Math.max(0, valorPago - totalACobrar);

  return {
    maquinas: [],
    totalEntradaPeriodo: Number(visita.total_entrada_periodo ?? 0),
    totalSaidaPeriodo: Number(visita.total_saida_periodo ?? 0),
    totalLucroCentavos: Number(visita.total_lucro_centavos),
    saldoNegativo: false,
    debitoTotalReais,
    recuperacaoNegativoReais: recuperacaoNegativo,
    debitoAbatidoReais: debitoAbatido,
    debitoRestanteReais,
    abatimentos: [],
    descontoManualReais: descontoManual,
    saldoAposDebitoReais: saldoAposDebito,
    saldoAposDescontoReais: saldoAposDesconto,
    valorClienteReais: valorCliente,
    valorOperacaoReais: valorOperacao,
    descontoRecebimentoReais: descontoRecebimento,
    valorOperacaoEfetivoReais: valorOperacaoEfetivo,
    totalACobrarReais: totalACobrar,
    pendenciaOperacaoTotalReais,
    pendenciaOperacaoIncluidaReais,
    pendenciaOperacaoAbatidaReais,
    pendenciaOperacaoRestanteReais,
    abatimentosPendenciaOperacao: [],
    valorDeixadoOperadorReais: descontoManual,
    valorPagoReais: valorPago,
    restanteOperacaoReais,
    restanteReais,
    haverTotalReais: 0,
    haverCompensadoReais: 0,
    haverQuitadoReais: 0,
    haverRestanteReais: 0,
    abatimentosHaver: [],
    haverReais,
    haverGeradoReais: 0,
    clientePagouGanhadores: false,
    novoDebitoReais: 0,
    saldoLiquidoReais: 0,
    maquinasDistribuidas: [],
    comissaoAplicada: saldoAposDebito > 0.009,
  };
}
