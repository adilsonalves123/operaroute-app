import { centesimosToReais, reaisToCentesimos } from "./contadores";
import type { AbatimentoDebito, BaixaPendenciaValor, PendenciaNegativaInput } from "./types";

const ABATIDO_REGEX = /Abatido R\$ ([\d.,]+)/g;
const BAIXA_REGEX = /Baixa de R\$ ([\d.,]+)/g;

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Total já baixado em pendências parcial/pagamento_pendente (campo descricao). */
export function extrairTotalBaixaDescricao(observacao: string | null | undefined): number {
  if (!observacao) return 0;
  let total = 0;
  for (const match of observacao.matchAll(BAIXA_REGEX)) {
    total += parseValorBR(match[1]);
  }
  return total;
}

/** Corrige valor/status quando a descrição já registra baixa total. */
export function saldoOperacaoAposBaixasRegistradas(p: {
  valor: number;
  descricao?: string | null;
}): number {
  const baixado = extrairTotalBaixaDescricao(p.descricao);
  return Math.max(0, Number(p.valor ?? 0) - baixado);
}

/** Extrai total já abatido do campo observação (GCP) */
export function extrairTotalAbatido(observacao: string | null | undefined): number {
  if (!observacao) return 0;
  let total = 0;
  for (const match of observacao.matchAll(ABATIDO_REGEX)) {
    const raw = match[1].replace(/\./g, "").replace(",", ".");
    total += parseFloat(raw) || 0;
  }
  return total;
}

/**
 * Saldo em aberto do haver.
 * Estilo moderno: `valor` já é o saldo (linhas Compensado são histórico).
 * Estilo antigo: `valor` bruto − linhas Abatido.
 */
export function saldoHaverReais(pendencia: {
  valor: number;
  observacao?: string | null;
  descricao?: string | null;
}): number {
  const obs = pendencia.observacao ?? pendencia.descricao ?? null;
  if (obs && /Compensado R\$/i.test(obs)) {
    return Math.max(0, Number(pendencia.valor ?? 0));
  }
  return saldoPendenciaReais({
    id: "",
    valor: Number(pendencia.valor ?? 0),
    observacao: obs,
  });
}

export function saldoPendenciaReais(pendencia: PendenciaNegativaInput): number {
  const jaAbatido = extrairTotalAbatido(pendencia.observacao);
  return Math.max(0, pendencia.valor - jaAbatido);
}

export function totalDebitoAbertoReais(
  pendencias: PendenciaNegativaInput[]
): number {
  return pendencias.reduce((s, p) => s + saldoPendenciaReais(p), 0);
}

/** Soma do haver em aberto (respeita estilo moderno Compensado vs antigo Abatido). */
export function totalHaverAbertoReais(
  pendencias: Array<{ valor: number; observacao?: string | null; descricao?: string | null }>
): number {
  return pendencias.reduce((s, p) => s + saldoHaverReais(p), 0);
}

/**
 * Haver gerado quando o cliente/ponto cobriu o prejuízo (pagou ganhadores).
 * Diferente do crédito de troco / pagamento a mais.
 * Afeta só a base da comissão — quem deve a quem continua sendo haver.
 */
export function isHaverDeNegativoCliente(p: {
  titulo?: string | null;
  descricao?: string | null;
  observacao?: string | null;
}): boolean {
  const t = `${p.titulo ?? ""} ${p.descricao ?? ""} ${p.observacao ?? ""}`.toLowerCase();
  return (
    t.includes("cliente pagou ganhadores") ||
    t.includes("ponto pagou ganhadores") ||
    t.includes("pagou ganhadores na visita negativa")
  );
}

/** Crédito comum: troco, pagamento a mais, etc. */
export function isHaverCreditoComum(p: {
  titulo?: string | null;
  descricao?: string | null;
  observacao?: string | null;
}): boolean {
  return !isHaverDeNegativoCliente(p);
}

export function totalHaverDeNegativoAbertoReais(
  pendencias: Array<{
    valor: number;
    titulo?: string | null;
    observacao?: string | null;
    descricao?: string | null;
  }>
): number {
  return totalHaverAbertoReais(pendencias.filter(isHaverDeNegativoCliente));
}

export function totalHaverCreditoComumAbertoReais(
  pendencias: Array<{
    valor: number;
    titulo?: string | null;
    observacao?: string | null;
    descricao?: string | null;
  }>
): number {
  return totalHaverAbertoReais(pendencias.filter(isHaverCreditoComum));
}

export function isPendenciaOperacao(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return (
    t === "pagamento_pendente" ||
    t === "parcial" ||
    t === "visita_consolidada"
  );
}

/** Tipos de pendência que representam dívida da operação a receber do ponto. */
export const TIPOS_PENDENCIA_OPERACAO = [
  "pagamento_pendente",
  "parcial",
  "visita_consolidada",
] as const;

/** Saldo cobrável: negativo usa abatimentos na descrição; demais usam valor atual. */
export function saldoPendenciaCobravel(p: {
  tipo: string;
  id: string;
  valor: number;
  observacao?: string | null;
}): number {
  if (p.tipo.toLowerCase() === "haver") return 0;
  if (p.tipo.toLowerCase() === "negativo") {
    return saldoPendenciaReais({
      id: p.id,
      valor: p.valor,
      observacao: p.observacao,
    });
  }
  return Math.max(0, p.valor);
}

export function calcularAbatimentos(
  pendencias: PendenciaNegativaInput[],
  totalLucroCentavos: number,
  dataColeta: Date = new Date()
): { abatimentos: AbatimentoDebito[]; debitoAbatidoCentavos: number } {
  let saldoDisponivel = Math.max(0, totalLucroCentavos);
  const abatimentos: AbatimentoDebito[] = [];
  const dataStr = dataColeta.toLocaleDateString("pt-BR");

  for (const pendencia of pendencias) {
    if (saldoDisponivel <= 0) break;

    const saldoReais = saldoPendenciaReais(pendencia);
    if (saldoReais <= 0) continue;

    const saldoCentavos = reaisToCentesimos(saldoReais);
    const abatidoCentavos = Math.min(saldoCentavos, saldoDisponivel);
    const abatidoReais = centesimosToReais(abatidoCentavos);
    saldoDisponivel -= abatidoCentavos;

    const saldoRestante = Math.max(0, saldoReais - abatidoReais);
    const linhaAbatimento = `Abatido R$ ${abatidoReais.toFixed(2).replace(".", ",")} na coleta de ${dataStr}`;
    const observacaoAtualizada = pendencia.observacao
      ? `${pendencia.observacao}\n${linhaAbatimento}`
      : linhaAbatimento;

    abatimentos.push({
      pendenciaId: pendencia.id,
      valorAbatidoReais: abatidoReais,
      saldoRestanteReais: saldoRestante,
      observacaoAtualizada,
      resolvida: saldoRestante <= 0.001,
    });
  }

  const debitoAbatidoCentavos = reaisToCentesimos(
    abatimentos.reduce((s, a) => s + a.valorAbatidoReais, 0)
  );

  return { abatimentos, debitoAbatidoCentavos };
}

/** Baixa pendências cujo saldo é o valor atual (pagamento_pendente / parcial). */
export function calcularBaixasValorPendencia(
  pendencias: PendenciaNegativaInput[],
  valorPagoCentavos: number,
  dataColeta: Date = new Date()
): { abatimentos: BaixaPendenciaValor[]; abatidoCentavos: number } {
  let saldoDisponivel = Math.max(0, valorPagoCentavos);
  const abatimentos: BaixaPendenciaValor[] = [];
  const dataStr = dataColeta.toLocaleDateString("pt-BR");

  for (const pendencia of pendencias) {
    if (saldoDisponivel <= 0) break;

    const saldoReais = Math.max(0, pendencia.valor);
    if (saldoReais <= 0) continue;

    const saldoCentavos = reaisToCentesimos(saldoReais);
    const abatidoCentavos = Math.min(saldoCentavos, saldoDisponivel);
    const abatidoReais = centesimosToReais(abatidoCentavos);
    saldoDisponivel -= abatidoCentavos;

    const valorRestante = Math.max(0, saldoReais - abatidoReais);
    const linha = `Baixa de R$ ${abatidoReais.toFixed(2).replace(".", ",")} na coleta de ${dataStr}`;
    const descricaoAtualizada = pendencia.observacao
      ? `${pendencia.observacao}\n${linha}`
      : linha;

    abatimentos.push({
      pendenciaId: pendencia.id,
      valorAbatidoReais: abatidoReais,
      valorRestanteReais: valorRestante,
      descricaoAtualizada,
      resolvida: valorRestante <= 0.001,
    });
  }

  const abatidoCentavos = reaisToCentesimos(
    abatimentos.reduce((s, a) => s + a.valorAbatidoReais, 0)
  );

  return { abatimentos, abatidoCentavos };
}
