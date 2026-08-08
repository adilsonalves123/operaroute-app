import { centesimosToReais } from "@/lib/nichos/cassino";

export const NICHO_MODULO_URSINHO = "ursinho";

export type BrindeUrsinho = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

export type LeituraUrsinhoInput = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtual: number;
  fotoUrl?: string | null;
  brindes: BrindeUrsinho[];
};

export type MaquinaUrsinhoCalculada = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtual: number;
  entradaPeriodo: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  custoBrindes: number;
  lucroReal: number;
  fotoUrl?: string | null;
  brindes: BrindeUrsinho[];
};

export type CalculoColetaUrsinho = {
  maquinas: MaquinaUrsinhoCalculada[];
  totalEntradaPeriodo: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  custoBrindes: number;
  lucroReal: number;
  valorPagoRecebido: number;
  saldoPendente: number;
  haver: number;
  quitado: boolean;
  comissaoPercentual: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ratearValorProporcional(pesos: number[], total: number): number[] {
  if (pesos.length === 0) return [];
  if (total <= 0.009) return pesos.map(() => 0);
  const soma = pesos.reduce((acc, item) => acc + item, 0);
  if (soma <= 0.009) return pesos.map(() => 0);

  const partes = pesos.map((peso) => roundMoney((total * peso) / soma));
  const diff = roundMoney(total - partes.reduce((acc, item) => acc + item, 0));
  if (Math.abs(diff) > 0.009) {
    partes[partes.length - 1] = roundMoney(partes[partes.length - 1] + diff);
  }
  return partes;
}

export function calcularMaquinaUrsinho(
  input: LeituraUrsinhoInput,
  comissaoPercentual: number,
  descontoMaquina = 0
): MaquinaUrsinhoCalculada {
  if (input.entradaAtual < input.entradaAnterior) {
    throw new Error(`Entrada atual menor que a anterior em ${input.nome}.`);
  }

  const entradaPeriodo = input.entradaAtual - input.entradaAnterior;
  const valorBruto = roundMoney(centesimosToReais(entradaPeriodo));
  const valorComissao = roundMoney((valorBruto * comissaoPercentual) / 100);
  const desconto = Math.max(0, descontoMaquina);
  const valorAReceber = roundMoney(Math.max(0, valorBruto - valorComissao - desconto));
  const custoBrindes = roundMoney(
    input.brindes.reduce(
      (acc, item) =>
        acc + Math.max(0, Number(item.quantidade) || 0) * Math.max(0, Number(item.custo_unitario) || 0),
      0
    )
  );

  return {
    equipamentoId: input.equipamentoId,
    nome: input.nome,
    entradaAnterior: input.entradaAnterior,
    entradaAtual: input.entradaAtual,
    entradaPeriodo,
    valorBruto,
    valorComissao,
    desconto,
    valorAReceber,
    custoBrindes,
    lucroReal: roundMoney(valorAReceber - custoBrindes),
    fotoUrl: input.fotoUrl ?? null,
    brindes: input.brindes,
  };
}

export function calcularColetaUrsinho(input: {
  leituras: LeituraUrsinhoInput[];
  comissaoPercentual: number;
  desconto?: number;
  valorPagoRecebido?: number;
}): CalculoColetaUrsinho {
  const comissaoPercentual = input.comissaoPercentual;
  const bases = input.leituras.map((leitura) => {
    const entradaPeriodo = leitura.entradaAtual - leitura.entradaAnterior;
    const valorBruto = roundMoney(centesimosToReais(entradaPeriodo));
    const valorComissao = roundMoney((valorBruto * comissaoPercentual) / 100);
    return roundMoney(Math.max(0, valorBruto - valorComissao));
  });

  const descontoMaximo = roundMoney(bases.reduce((acc, item) => acc + item, 0));
  const descontoTotal = roundMoney(Math.min(Math.max(0, input.desconto || 0), descontoMaximo));
  const descontosMaquina = ratearValorProporcional(bases, descontoTotal);

  const maquinas = input.leituras.map((leitura, index) =>
    calcularMaquinaUrsinho(leitura, comissaoPercentual, descontosMaquina[index] ?? 0)
  );

  const valorAReceber = roundMoney(maquinas.reduce((acc, item) => acc + item.valorAReceber, 0));
  const valorPagoRecebido = Math.max(0, input.valorPagoRecebido || 0);
  const saldoPendente = roundMoney(Math.max(0, valorAReceber - valorPagoRecebido));
  const haver = roundMoney(Math.max(0, valorPagoRecebido - valorAReceber));

  return {
    maquinas,
    totalEntradaPeriodo: maquinas.reduce((acc, item) => acc + item.entradaPeriodo, 0),
    valorBruto: roundMoney(maquinas.reduce((acc, item) => acc + item.valorBruto, 0)),
    valorComissao: roundMoney(maquinas.reduce((acc, item) => acc + item.valorComissao, 0)),
    desconto: descontoTotal,
    valorAReceber,
    custoBrindes: roundMoney(maquinas.reduce((acc, item) => acc + item.custoBrindes, 0)),
    lucroReal: roundMoney(maquinas.reduce((acc, item) => acc + item.lucroReal, 0)),
    valorPagoRecebido,
    saldoPendente,
    haver,
    quitado: saldoPendente <= 0.009,
    comissaoPercentual,
  };
}
