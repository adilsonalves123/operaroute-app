import type { RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";
import type { RelatorioFuraFuraData } from "@/lib/nichos/fura-fura/relatorio";
import type { RelatorioUrsinhoData } from "@/lib/nichos/ursinho/relatorio";
import type { RelatorioDiversaoData } from "@/lib/nichos/diversao/relatorio";
import type { RelatorioBolinhaData } from "@/lib/nichos/bolinha/relatorio";
import type { RelatorioConsignadoData } from "@/lib/nichos/consignado/relatorio";
import {
  roundMoney,
  snapshotFromRelatorioCassino,
  type ComprovanteMaquinaSnap,
  type ComprovanteSnapshot,
} from "@/lib/comprovantes/types";

/** Snapshot padrão dos nichos com valor a receber / pago / pendente / haver gerado. */
export function snapshotFromNichoPadrao(opts: {
  empresaNome: string;
  pontoNome: string;
  chavePix?: string | null;
  data?: Date | string;
  previa?: boolean;
  nichoLabel: string;
  maquinas?: ComprovanteMaquinaSnap[];
  valorBruto?: number;
  comissao?: number;
  comissaoPercentual?: number;
  desconto?: number;
  valorAReceber: number;
  valorPago?: number;
  saldoPendente?: number;
  haverGerado?: number;
  /** Quando a prévia inclui dívida anterior / abatimentos na cobrança. */
  totalACobrarOverride?: number;
  /** Dívida/pendência anterior incluída nesta cobrança. */
  divida?: number;
  /** Haver abatido nesta cobrança. */
  haverAbatido?: number;
  /** Haver que o ponto tinha antes. */
  haverAnterior?: number;
  /** Haver restante após abatimento. */
  haverRestante?: number;
  notas?: string[];
}): ComprovanteSnapshot {
  const dataIso =
    opts.data instanceof Date
      ? opts.data.toISOString()
      : typeof opts.data === "string"
        ? opts.data
        : new Date().toISOString();

  const valorAReceber = roundMoney(opts.valorAReceber);
  const desconto = roundMoney(opts.desconto ?? 0);
  const valorPago = roundMoney(opts.valorPago ?? 0);
  const haverGerado = roundMoney(opts.haverGerado ?? 0);
  const divida = roundMoney(opts.divida ?? 0);
  const haverAbatido = roundMoney(opts.haverAbatido ?? 0);
  const haverAnterior = roundMoney(
    opts.haverAnterior ??
      (haverAbatido > 0.009 ? haverAbatido + (opts.haverRestante ?? 0) : 0)
  );
  const haverRestante = roundMoney(
    opts.haverRestante != null
      ? opts.haverRestante
      : Math.max(0, haverAnterior - haverAbatido)
  );
  const totalACobrar = roundMoney(
    opts.totalACobrarOverride != null ? opts.totalACobrarOverride : valorAReceber
  );
  const restante = roundMoney(
    opts.saldoPendente != null
      ? opts.saldoPendente
      : Math.max(0, totalACobrar - valorPago)
  );
  const subtotal = roundMoney(valorAReceber + desconto);
  const totalBruto = roundMoney(totalACobrar + haverAbatido);

  return {
    empresaNome: (opts.empresaNome ?? "").trim() || "Operação",
    chavePix: opts.chavePix?.trim() || null,
    pontoNome: opts.pontoNome,
    dataIso,
    previa: opts.previa === true,
    nichos: [{ label: opts.nichoLabel, valor: valorAReceber }],
    maquinas: opts.maquinas?.length ? opts.maquinas : undefined,
    valorOperacional: valorAReceber,
    comissao: roundMoney(opts.comissao ?? 0),
    comissaoPercentual: opts.comissaoPercentual,
    subtotal,
    divida,
    desconto,
    haverAbatido,
    totalACobrar,
    valorPago,
    restante,
    haverGerado,
    haverAnterior: haverAnterior > 0.009 ? haverAnterior : undefined,
    haverRestante:
      haverAbatido > 0.009 || haverRestante > 0.009 ? haverRestante : undefined,
    totalBruto,
    notas: opts.notas,
  };
}

type SnapshotNichoOpts = {
  chavePix?: string | null;
  valorACobrar?: number;
  divida?: number;
  haverAbatido?: number;
  haverAnterior?: number;
  haverRestante?: number;
};

export function snapshotFromRelatorioColetaData(
  data: RelatorioColetaData,
  opts?: { previa?: boolean; chavePix?: string | null }
): ComprovanteSnapshot {
  const c = data.calculo;
  const prejuizoReais = Math.abs((c.totalLucroCentavos ?? 0) / 100);
  return snapshotFromRelatorioCassino({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: opts?.previa ?? data.previa,
    maquinas: data.maquinas.map((m) => ({
      nome: m.nome,
      lucroCentavos: m.lucroCentavos,
      entradaAtual: m.entradaAtual,
      saidaAtual: m.saidaAtual,
    })),
    valorOperacional: c.valorOperacaoReais ?? 0,
    comissao: c.valorClienteReais ?? 0,
    comissaoPercentual: data.comissaoPercentual,
    subtotal: c.valorOperacaoEfetivoReais ?? c.valorOperacaoReais ?? 0,
    desconto: c.saldoNegativo
      ? c.descontoRecebimentoReais ?? 0
      : (c.descontoRecebimentoReais ?? 0) + (c.descontoManualReais ?? 0),
    totalACobrar: c.totalACobrarReais ?? c.valorOperacaoEfetivoReais ?? 0,
    valorPago: c.valorPagoReais ?? 0,
    restante: c.restanteReais ?? 0,
    saldoNegativo: c.saldoNegativo,
    prejuizo: prejuizoReais,
    valorDeixado: c.valorDeixadoOperadorReais ?? 0,
    haverGerado: c.haverGeradoReais ?? 0,
    haverAbatido: c.haverCompensadoReais ?? 0,
    haverRestante: Math.max(
      0,
      (c.haverTotalReais ?? 0) - (c.haverCompensadoReais ?? 0)
    ),
    haverAnterior: c.haverTotalReais ?? 0,
    totalBruto: (c.totalACobrarReais ?? 0) + (c.haverCompensadoReais ?? 0),
    negativoAnterior: c.debitoTotalReais ?? 0,
    negativoRecuperado:
      (c.recuperacaoNegativoReais ?? 0) > 0.009
        ? c.recuperacaoNegativoReais
        : c.debitoAbatidoReais ?? 0,
    negativoRestante: c.debitoRestanteReais ?? 0,
  });
}

export function snapshotFromRelatorioFuraFura(
  data: RelatorioFuraFuraData,
  opts?: SnapshotNichoOpts
): ComprovanteSnapshot {
  const c = data.calculo;
  const notas: string[] = [];
  if (data.kitNome) notas.push(`Kit: ${data.kitNome}`);
  notas.push(`Furos: ${c.quantidadeFuros} × ${c.precoFuro}`);
  const cobranca = data.cobranca;
  return snapshotFromNichoPadrao({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: data.previa,
    nichoLabel: "Fura-Fura",
    valorBruto: c.valorBruto,
    comissao: c.valorComissao,
    comissaoPercentual: c.comissaoPercentual,
    desconto: c.desconto,
    valorAReceber: c.valorAReceber,
    valorPago: c.valorPagoRecebido,
    saldoPendente: c.saldoPendente,
    haverGerado: c.haver,
    totalACobrarOverride: opts?.valorACobrar ?? cobranca?.totalACobrar,
    divida: opts?.divida ?? cobranca?.dividaAnterior,
    haverAbatido: opts?.haverAbatido ?? cobranca?.haverAbatido,
    haverAnterior: opts?.haverAnterior ?? cobranca?.haverAnterior,
    haverRestante: opts?.haverRestante,
    notas,
  });
}

export function snapshotFromRelatorioUrsinho(
  data: RelatorioUrsinhoData,
  opts?: SnapshotNichoOpts
): ComprovanteSnapshot {
  const c = data.calculo;
  const cobranca = data.cobranca;
  return snapshotFromNichoPadrao({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: data.previa,
    nichoLabel: "Ursinho",
    maquinas: data.maquinas.map((m) => ({
      nome: m.nome,
      lucro: roundMoney(m.lucroReal),
      entradaAtual: m.entradaAtual,
    })),
    valorBruto: c.valorBruto,
    comissao: c.valorComissao,
    comissaoPercentual: c.comissaoPercentual,
    desconto: c.desconto,
    valorAReceber: c.valorAReceber,
    valorPago: c.valorPagoRecebido,
    saldoPendente: c.saldoPendente,
    haverGerado: c.haver,
    totalACobrarOverride: opts?.valorACobrar ?? cobranca?.totalACobrar,
    divida: opts?.divida ?? cobranca?.dividaAnterior,
    haverAbatido: opts?.haverAbatido ?? cobranca?.haverAbatido,
    haverAnterior: opts?.haverAnterior ?? cobranca?.haverAnterior,
    haverRestante: opts?.haverRestante,
  });
}

export function snapshotFromRelatorioDiversao(
  data: RelatorioDiversaoData,
  opts?: SnapshotNichoOpts
): ComprovanteSnapshot {
  const c = data.calculo;
  const cobranca = data.cobranca;
  return snapshotFromNichoPadrao({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: data.previa,
    nichoLabel: "Diversão",
    maquinas: data.maquinas.map((m) => ({
      nome: m.nome,
      lucro: roundMoney(m.lucroReal),
      entradaAtual: m.entradaAtual,
    })),
    valorBruto: c.valorBruto,
    comissao: c.valorComissao,
    comissaoPercentual: c.comissaoPercentual,
    desconto: c.desconto,
    valorAReceber: c.valorAReceber,
    valorPago: c.valorPagoRecebido,
    saldoPendente: c.saldoPendente,
    haverGerado: c.haver,
    totalACobrarOverride: opts?.valorACobrar ?? cobranca?.totalACobrar,
    divida: opts?.divida ?? cobranca?.dividaAnterior,
    haverAbatido: opts?.haverAbatido ?? cobranca?.haverAbatido,
    haverAnterior: opts?.haverAnterior ?? cobranca?.haverAnterior,
    haverRestante: opts?.haverRestante,
  });
}

export function snapshotFromRelatorioBolinha(
  data: RelatorioBolinhaData,
  opts?: SnapshotNichoOpts
): ComprovanteSnapshot {
  const c = data.calculo;
  const cobranca = data.cobranca;
  return snapshotFromNichoPadrao({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: data.previa,
    nichoLabel: "Bolinha",
    maquinas: data.maquinas.map((m) => ({
      nome: m.nome,
      lucro: roundMoney(m.lucroReal),
      entradaAtual: m.entradaAtual,
    })),
    valorBruto: c.valorBruto,
    comissao: c.valorComissao,
    comissaoPercentual: c.comissaoPercentual,
    desconto: c.desconto,
    valorAReceber: c.valorAReceber,
    valorPago: c.valorPagoRecebido,
    saldoPendente: c.saldoPendente,
    haverGerado: c.haver,
    totalACobrarOverride: opts?.valorACobrar ?? cobranca?.totalACobrar,
    divida: opts?.divida ?? cobranca?.dividaAnterior,
    haverAbatido: opts?.haverAbatido ?? cobranca?.haverAbatido,
    haverAnterior: opts?.haverAnterior ?? cobranca?.haverAnterior,
    haverRestante: opts?.haverRestante,
  });
}

export function snapshotFromRelatorioConsignado(
  data: RelatorioConsignadoData,
  opts?: SnapshotNichoOpts
): ComprovanteSnapshot {
  const c = data.calculo;
  const cobranca = data.cobranca;
  return snapshotFromNichoPadrao({
    empresaNome: data.empresaNome,
    pontoNome: data.pontoNome,
    chavePix: opts?.chavePix,
    data: data.data,
    previa: data.previa,
    nichoLabel: "Consignado",
    maquinas: data.expositores.map((e) => ({
      nome: e.nome,
      lucro: roundMoney(e.lucroReal),
    })),
    valorBruto: c.valorBruto,
    comissao: c.valorComissao,
    comissaoPercentual: c.comissaoPercentual,
    desconto: c.desconto,
    valorAReceber: c.valorAReceber,
    valorPago: c.valorPagoRecebido,
    saldoPendente: c.saldoPendente,
    haverGerado: c.haver,
    totalACobrarOverride: opts?.valorACobrar ?? cobranca?.totalACobrar,
    divida: opts?.divida ?? cobranca?.dividaAnterior,
    haverAbatido: opts?.haverAbatido ?? cobranca?.haverAbatido,
    haverAnterior: opts?.haverAnterior ?? cobranca?.haverAnterior,
    haverRestante: opts?.haverRestante,
  });
}

/** Snapshot a partir de uma linha `coletas` (histórico). */
export function snapshotFromColetaRow(opts: {
  empresaNome: string;
  pontoNome: string;
  chavePix?: string | null;
  nichoLabel: string;
  createdAt: string;
  valorAReceber: number;
  valorPago: number;
  saldoPendente: number;
  desconto?: number;
  comissao?: number;
  comissaoPercentual?: number;
  valorBruto?: number;
  haverGerado?: number;
  maquinas?: ComprovanteMaquinaSnap[];
  notas?: string[];
}): ComprovanteSnapshot {
  return snapshotFromNichoPadrao({
    empresaNome: opts.empresaNome,
    pontoNome: opts.pontoNome,
    chavePix: opts.chavePix,
    data: opts.createdAt,
    previa: false,
    nichoLabel: opts.nichoLabel,
    maquinas: opts.maquinas,
    valorBruto: opts.valorBruto,
    comissao: opts.comissao,
    comissaoPercentual: opts.comissaoPercentual,
    desconto: opts.desconto,
    valorAReceber: opts.valorAReceber,
    valorPago: opts.valorPago,
    saldoPendente: opts.saldoPendente,
    haverGerado: opts.haverGerado,
    notas: opts.notas,
  });
}
