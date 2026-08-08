import { reaisToCentesimos } from "@/lib/nichos/cassino";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";

export const NICHO_MODULO_BOLINHA = "bolinha";

export type BrindeBolinha = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

export type LeituraBolinhaInput = {
  equipamentoId: string;
  nome: string;
  /** Dinheiro contado no ponto (R$) nesta coleta */
  valorContado: number;
  /** Preço da jogada cadastrado na máquina (R$) */
  precoJogada: number;
  /** Acumulado anterior em centavos (histórico opcional) */
  entradaAnteriorCentavos?: number;
  fotoUrl?: string | null;
  /** Se omitido, o calc monta a partir do estoque da máquina */
  brindes?: BrindeBolinha[];
  estoqueMaquina?: EstoqueBrindePonto[];
};

export type MaquinaBolinhaCalculada = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtual: number;
  /** Unidades (cápsulas/bolinhas) que saíram */
  entradaPeriodo: number;
  valorContado: number;
  precoJogada: number;
  unidadesSaiu: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  custoBrindes: number;
  lucroReal: number;
  fotoUrl?: string | null;
  brindes: BrindeBolinha[];
};

export type CalculoColetaBolinha = {
  maquinas: MaquinaBolinhaCalculada[];
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

/** Calcula quantas jogadas/cápsulas saíram a partir do dinheiro contado. */
export function calcularUnidadesBolinha(valorContado: number, precoJogada: number): number {
  const valor = Math.max(0, Number(valorContado) || 0);
  const preco = Math.max(0, Number(precoJogada) || 0);
  if (preco <= 0.009) return 0;
  return Math.floor((valor + 1e-9) / preco);
}

/**
 * Baixa automática: consome do estoque alocado na máquina (ordem do array).
 */
export function montarBrindesAutomaticos(
  estoque: EstoqueBrindePonto[],
  unidades: number,
  nomeMaquina: string
): BrindeBolinha[] {
  const qty = Math.max(0, Math.floor(unidades));
  if (qty <= 0) return [];

  const disponivel = estoque.reduce((acc, item) => acc + Math.max(0, Number(item.quantidade) || 0), 0);
  if (disponivel < qty) {
    throw new Error(
      `${nomeMaquina}: estoque insuficiente. Precisa de ${qty} cápsulas, tem ${disponivel} alocadas.`
    );
  }

  let restante = qty;
  const out: BrindeBolinha[] = [];
  for (const item of estoque) {
    if (restante <= 0) break;
    const naMaquina = Math.max(0, Math.floor(Number(item.quantidade) || 0));
    if (naMaquina <= 0) continue;
    const usar = Math.min(naMaquina, restante);
    out.push({
      item_id: item.item_id,
      nome: item.nome,
      quantidade: usar,
      custo_unitario: Math.max(0, Number(item.custo_unitario) || 0),
    });
    restante -= usar;
  }

  if (restante > 0) {
    throw new Error(
      `${nomeMaquina}: não foi possível alocar ${qty} cápsulas no estoque da máquina.`
    );
  }
  return out;
}

export function calcularMaquinaBolinha(
  input: LeituraBolinhaInput,
  comissaoPercentual: number,
  descontoMaquina = 0
): MaquinaBolinhaCalculada {
  const valorContado = roundMoney(Math.max(0, Number(input.valorContado) || 0));
  const precoJogada = roundMoney(Math.max(0, Number(input.precoJogada) || 0));

  if (precoJogada <= 0.009) {
    throw new Error(`Informe o valor da jogada em ${input.nome}.`);
  }

  const unidadesSaiu = calcularUnidadesBolinha(valorContado, precoJogada);

  let brindes = (input.brindes ?? []).filter((b) => b.quantidade > 0);
  if (brindes.length === 0 && unidadesSaiu > 0) {
    brindes = montarBrindesAutomaticos(input.estoqueMaquina ?? [], unidadesSaiu, input.nome);
  } else if (unidadesSaiu > 0) {
    const totalInformado = brindes.reduce((acc, b) => acc + b.quantidade, 0);
    if (totalInformado !== unidadesSaiu) {
      brindes = montarBrindesAutomaticos(input.estoqueMaquina ?? [], unidadesSaiu, input.nome);
    }
  }

  const valorBruto = valorContado;
  const valorComissao = roundMoney((valorBruto * comissaoPercentual) / 100);
  const desconto = Math.max(0, descontoMaquina);
  const valorAReceber = roundMoney(Math.max(0, valorBruto - valorComissao - desconto));
  const custoBrindes = roundMoney(
    brindes.reduce(
      (acc, item) =>
        acc +
        Math.max(0, Number(item.quantidade) || 0) * Math.max(0, Number(item.custo_unitario) || 0),
      0
    )
  );

  const entradaAnterior = Math.max(0, Math.round(Number(input.entradaAnteriorCentavos) || 0));
  const entradaAtual = entradaAnterior + reaisToCentesimos(valorContado);

  return {
    equipamentoId: input.equipamentoId,
    nome: input.nome,
    entradaAnterior,
    entradaAtual,
    entradaPeriodo: unidadesSaiu,
    valorContado,
    precoJogada,
    unidadesSaiu,
    valorBruto,
    valorComissao,
    desconto,
    valorAReceber,
    custoBrindes,
    lucroReal: roundMoney(valorAReceber - custoBrindes),
    fotoUrl: input.fotoUrl ?? null,
    brindes,
  };
}

export function calcularColetaBolinha(input: {
  leituras: LeituraBolinhaInput[];
  comissaoPercentual: number;
  desconto?: number;
  valorPagoRecebido?: number;
}): CalculoColetaBolinha {
  const comissaoPercentual = input.comissaoPercentual;
  const bases = input.leituras.map((leitura) => {
    const valorBruto = roundMoney(Math.max(0, Number(leitura.valorContado) || 0));
    const valorComissao = roundMoney((valorBruto * comissaoPercentual) / 100);
    return roundMoney(Math.max(0, valorBruto - valorComissao));
  });

  const descontoMaximo = roundMoney(bases.reduce((acc, item) => acc + item, 0));
  const descontoTotal = roundMoney(Math.min(Math.max(0, input.desconto || 0), descontoMaximo));
  const descontosMaquina = ratearValorProporcional(bases, descontoTotal);

  const maquinas = input.leituras.map((leitura, index) =>
    calcularMaquinaBolinha(leitura, comissaoPercentual, descontosMaquina[index] ?? 0)
  );

  const valorAReceber = roundMoney(maquinas.reduce((acc, item) => acc + item.valorAReceber, 0));
  const valorPagoRecebido = Math.max(0, input.valorPagoRecebido || 0);
  const saldoPendente = roundMoney(Math.max(0, valorAReceber - valorPagoRecebido));
  const haver = roundMoney(Math.max(0, valorPagoRecebido - valorAReceber));

  return {
    maquinas,
    totalEntradaPeriodo: maquinas.reduce((acc, item) => acc + item.unidadesSaiu, 0),
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
