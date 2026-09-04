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

/** Débito cassino (visita negativa) — recupera no lucro das positivas. */
export function isNegativoCassinoVisita(p: {
  tipo?: string | null;
  visita_id?: string | null;
}): boolean {
  return (p.tipo ?? "").toLowerCase() === "negativo" && Boolean(p.visita_id);
}

/**
 * Manual "deixei no ponto sem leitura" — abate na próxima coleta negativa
 * (mesmo fluxo de pagamento pendente), não soma como débito negativo.
 */
export function isNegativoManualSemLeitura(p: {
  tipo?: string | null;
  visita_id?: string | null;
}): boolean {
  return (p.tipo ?? "").toLowerCase() === "negativo" && !p.visita_id;
}

export function partitionPendenciasNegativasCassino<
  T extends {
    id: string;
    valor: number | null;
    descricao: string | null;
    visita_id?: string | null;
    tipo?: string | null;
    titulo?: string | null;
  },
>(rows: T[] | null | undefined): {
  negativosCassino: T[];
  operacaoSemLeitura: T[];
} {
  const negativosCassino: T[] = [];
  const operacaoSemLeitura: T[] = [];
  for (const p of rows ?? []) {
    if (isNegativoManualSemLeitura(p)) operacaoSemLeitura.push(p);
    else negativosCassino.push(p);
  }
  return { negativosCassino, operacaoSemLeitura };
}

/** Tipos de pendência que representam dívida da operação a receber do ponto. */
export const TIPOS_PENDENCIA_OPERACAO = [
  "pagamento_pendente",
  "parcial",
  "visita_consolidada",
] as const;

/** Saldo cobrável: negativo cassino usa abatimentos; manual sem leitura = operação. */
export function saldoPendenciaCobravel(p: {
  tipo: string;
  id: string;
  valor: number;
  observacao?: string | null;
  visita_id?: string | null;
}): number {
  if (p.tipo.toLowerCase() === "haver") return 0;
  if (isNegativoManualSemLeitura(p)) {
    return Math.max(0, p.valor);
  }
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

function parseValorBRLinha(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Remove baixas/compensações desta visita na descrição.
 * Usado na edição: a visita ainda "segura" esses abatimentos até salvar de novo.
 */
export function descricaoSemBaixasDaVisita(
  descricao: string | null | undefined,
  visitaId: string
): string | null {
  if (!descricao) return null;
  const tag = `[visita:${visitaId}]`;
  const manter = descricao
    .split("\n")
    .filter((linha) => !linha.includes(tag))
    .map((l) => l.trimEnd())
    .filter(Boolean);
  return manter.length ? manter.join("\n") : null;
}

/** Soma o que esta visita baixou/compensou (linhas com [visita:id]). */
export function valorBaixadoPelaVisitaNaDescricao(
  descricao: string | null | undefined,
  visitaId: string
): number {
  if (!descricao) return 0;
  const tag = `[visita:${visitaId}]`;
  let total = 0;
  for (const linha of descricao.split("\n")) {
    if (!linha.includes(tag)) continue;
    const m =
      linha.match(/Compensado R\$ ([\d.,]+)/i) ??
      linha.match(/Abatido R\$ ([\d.,]+)/i) ??
      linha.match(/Baixa de R\$ ([\d.,]+)/i);
    if (m) total += parseValorBRLinha(m[1]);
  }
  return Math.round(total * 100) / 100;
}

export type PendenciaParaEdicaoVisita = {
  id: string;
  valor: number;
  descricao: string | null;
  tipo: string | null;
  titulo: string | null;
  status?: string | null;
};

/**
 * Prepara pendências para recalcular a visita em edição:
 * devolve o que esta visita já tinha abatido (senão a comissão infla).
 */
export function pendenciasParaEdicaoVisita(
  rows: PendenciaParaEdicaoVisita[],
  visitaId: string
): PendenciaParaEdicaoVisita[] {
  const tag = `[visita:${visitaId}]`;
  const out: PendenciaParaEdicaoVisita[] = [];

  for (const p of rows) {
    const desc = p.descricao ?? "";
    const destaVisita = desc.includes(tag);
    const aberta = String(p.status ?? "aberta").toLowerCase() === "aberta";

    if (!destaVisita && !aberta) continue;

    if (!destaVisita) {
      out.push({
        id: p.id,
        valor: Number(p.valor ?? 0),
        descricao: p.descricao,
        tipo: p.tipo,
        titulo: p.titulo,
        status: "aberta",
      });
      continue;
    }

    const baixado = valorBaixadoPelaVisitaNaDescricao(desc, visitaId);
    const descLimpa = descricaoSemBaixasDaVisita(desc, visitaId);
    const valorBase = Number(p.valor ?? 0);
    // Haver/operação: valor já é saldo restante → devolve o que esta visita baixou.
    // Negativo: valor bruto + linhas Abatido → só limpar a descrição.
    const valorEraSaldoRestante = /Compensado R\$|Baixa de R\$/i.test(desc);
    const valor = valorEraSaldoRestante
      ? Math.round((valorBase + baixado) * 100) / 100
      : valorBase;

    out.push({
      id: p.id,
      valor,
      descricao: descLimpa,
      tipo: p.tipo,
      titulo: p.titulo,
      status: "aberta",
    });
  }

  return out;
}
