import { centesimosToReais } from "@/lib/nichos/cassino";
import { ratearValorProporcional } from "@/lib/nichos/ursinho";
import {
  DIVERSAO_EQUIPAMENTO_TIPOS,
  isEquipamentoTipoDiversao,
} from "@/lib/equipamentos";

export const NICHO_MODULO_DIVERSAO = "diversao";

export { DIVERSAO_EQUIPAMENTO_TIPOS, ratearValorProporcional };

export function isEquipamentoDiversao(tipo: string | null | undefined): boolean {
  return isEquipamentoTipoDiversao(tipo ?? "");
}

export type LeituraDiversaoInput = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtual: number;
  fotoUrl?: string | null;
};

export type MaquinaDiversaoCalculada = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtual: number;
  entradaPeriodo: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  lucroReal: number;
  fotoUrl?: string | null;
};

export type CalculoColetaDiversao = {
  maquinas: MaquinaDiversaoCalculada[];
  totalEntradaPeriodo: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
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

export function calcularMaquinaDiversao(
  input: LeituraDiversaoInput,
  comissaoPercentual: number,
  descontoMaquina = 0
): MaquinaDiversaoCalculada {
  if (input.entradaAtual < input.entradaAnterior) {
    throw new Error(`Entrada atual menor que a anterior em ${input.nome}.`);
  }

  const entradaPeriodo = input.entradaAtual - input.entradaAnterior;
  const valorBruto = roundMoney(centesimosToReais(entradaPeriodo));
  const valorComissao = roundMoney((valorBruto * comissaoPercentual) / 100);
  const desconto = Math.max(0, descontoMaquina);
  const valorAReceber = roundMoney(Math.max(0, valorBruto - valorComissao - desconto));

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
    lucroReal: valorAReceber,
    fotoUrl: input.fotoUrl ?? null,
  };
}

export function calcularColetaDiversao(input: {
  leituras: LeituraDiversaoInput[];
  comissaoPercentual: number;
  desconto?: number;
  valorPagoRecebido?: number;
}): CalculoColetaDiversao {
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
    calcularMaquinaDiversao(leitura, comissaoPercentual, descontosMaquina[index] ?? 0)
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
    lucroReal: roundMoney(maquinas.reduce((acc, item) => acc + item.lucroReal, 0)),
    valorPagoRecebido,
    saldoPendente,
    haver,
    quitado: saldoPendente <= 0.009,
    comissaoPercentual,
  };
}
