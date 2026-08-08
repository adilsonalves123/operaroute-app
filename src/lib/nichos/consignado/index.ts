export const NICHO_MODULO_CONSIGNADO = "consignado";

export type ModoComissaoConsignado = "percentual" | "tabela";

/** Linha de produto no recolhe consignado. */
export type LinhaConsignadoInput = {
  produtoId?: string;
  codigo?: string | null;
  nome: string;
  /** Quantidade que estava no expositor (deixada na última visita) */
  deixado: number;
  /** Quantidade contada agora na prateleira */
  sobrou: number;
  /** Quantidade reposta agora */
  reposto: number;
  custoUnitario: number;
  precoVenda: number;
  /** Comissão fixa em R$ por unidade (modo tabela) */
  comissaoFixa?: number | null;
};

export type LinhaConsignadoCalculada = {
  produtoId?: string;
  codigo?: string | null;
  nome: string;
  deixado: number;
  sobrou: number;
  reposto: number;
  vendido: number;
  custoUnitario: number;
  precoVenda: number;
  comissaoFixa?: number | null;
  receita: number;
  comissao: number;
  aReceber: number;
  custo: number;
  lucro: number;
  /** Novo saldo que fica no expositor = sobrou + reposto */
  novoSaldo: number;
};

export type CalculoColetaConsignado = {
  modoComissao: ModoComissaoConsignado;
  comissaoPercentual: number;
  linhas: LinhaConsignadoCalculada[];
  totalVendido: number;
  valorBruto: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  custoProdutos: number;
  lucroReal: number;
  valorPagoRecebido: number;
  saldoPendente: number;
  haver: number;
  quitado: boolean;
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

export function calcularLinhaConsignado(
  input: LinhaConsignadoInput,
  modoComissao: ModoComissaoConsignado,
  comissaoPercentual: number
): LinhaConsignadoCalculada {
  const deixado = Math.max(0, Math.floor(Number(input.deixado) || 0));
  const sobrou = Math.max(0, Math.floor(Number(input.sobrou) || 0));
  const reposto = Math.max(0, Math.floor(Number(input.reposto) || 0));

  if (sobrou > deixado) {
    throw new Error(`${input.nome}: sobrou (${sobrou}) não pode ser maior que o deixado (${deixado}).`);
  }

  const vendido = Math.max(0, deixado - sobrou);
  const precoVenda = Math.max(0, Number(input.precoVenda) || 0);
  const custoUnitario = Math.max(0, Number(input.custoUnitario) || 0);
  const comissaoFixa = Math.max(0, Number(input.comissaoFixa) || 0);

  const receita = roundMoney(vendido * precoVenda);
  const comissao =
    modoComissao === "tabela"
      ? roundMoney(vendido * comissaoFixa)
      : roundMoney((receita * comissaoPercentual) / 100);
  const aReceber = roundMoney(Math.max(0, receita - comissao));
  const custo = roundMoney(vendido * custoUnitario);
  const lucro = roundMoney(aReceber - custo);

  return {
    produtoId: input.produtoId,
    codigo: input.codigo ?? null,
    nome: input.nome,
    deixado,
    sobrou,
    reposto,
    vendido,
    custoUnitario,
    precoVenda,
    comissaoFixa: input.comissaoFixa ?? null,
    receita,
    comissao,
    aReceber,
    custo,
    lucro,
    novoSaldo: sobrou + reposto,
  };
}

export function calcularColetaConsignado(input: {
  linhas: LinhaConsignadoInput[];
  modoComissao: ModoComissaoConsignado;
  comissaoPercentual: number;
  desconto?: number;
  valorPagoRecebido?: number;
}): CalculoColetaConsignado {
  const modoComissao = input.modoComissao;
  const comissaoPercentual = Math.max(0, Number(input.comissaoPercentual) || 0);

  const linhas = input.linhas.map((linha) =>
    calcularLinhaConsignado(linha, modoComissao, comissaoPercentual)
  );

  const valorBruto = roundMoney(linhas.reduce((acc, l) => acc + l.receita, 0));
  const valorComissao = roundMoney(linhas.reduce((acc, l) => acc + l.comissao, 0));

  const aReceberBruto = roundMoney(linhas.reduce((acc, l) => acc + l.aReceber, 0));
  const descontoTotal = roundMoney(Math.min(Math.max(0, input.desconto || 0), aReceberBruto));
  const valorAReceber = roundMoney(Math.max(0, aReceberBruto - descontoTotal));

  const custoProdutos = roundMoney(linhas.reduce((acc, l) => acc + l.custo, 0));
  const lucroReal = roundMoney(valorAReceber - custoProdutos);

  const valorPagoRecebido = Math.max(0, input.valorPagoRecebido || 0);
  const saldoPendente = roundMoney(Math.max(0, valorAReceber - valorPagoRecebido));
  const haver = roundMoney(Math.max(0, valorPagoRecebido - valorAReceber));

  return {
    modoComissao,
    comissaoPercentual,
    linhas,
    totalVendido: linhas.reduce((acc, l) => acc + l.vendido, 0),
    valorBruto,
    valorComissao,
    desconto: descontoTotal,
    valorAReceber,
    custoProdutos,
    lucroReal,
    valorPagoRecebido,
    saldoPendente,
    haver,
    quitado: saldoPendente <= 0.009,
  };
}
