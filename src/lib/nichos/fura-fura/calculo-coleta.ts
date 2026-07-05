export type BrindeEntregue = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

export type CalculoColetaFuraFuraInput = {
  quantidadeFuros: number;
  precoFuro: number;
  comissaoPercentual: number;
  desconto: number;
  brindes: BrindeEntregue[];
  valorPagoRecebido: number;
};

export type CalculoColetaFuraFuraResult = {
  quantidadeFuros: number;
  precoFuro: number;
  valorBruto: number;
  comissaoPercentual: number;
  valorComissao: number;
  desconto: number;
  valorAReceber: number;
  custoBrindes: number;
  lucroReal: number;
  valorPagoRecebido: number;
  saldoPendente: number;
  quitado: boolean;
};

function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularColetaFuraFura(
  input: CalculoColetaFuraFuraInput
): CalculoColetaFuraFuraResult {
  const furos = Math.max(0, Math.floor(input.quantidadeFuros || 0));
  const precoFuro = Math.max(0, input.precoFuro || 0);
  const comissaoPct = Math.max(0, input.comissaoPercentual || 0);
  const desconto = Math.max(0, input.desconto || 0);
  const valorPagoRecebido = Math.max(0, input.valorPagoRecebido || 0);

  const valorBruto = arredondar(furos * precoFuro);
  const valorComissao = arredondar((valorBruto * comissaoPct) / 100);
  const valorAReceber = arredondar(Math.max(0, valorBruto - valorComissao - desconto));
  const custoBrindes = arredondar(
    (input.brindes ?? []).reduce(
      (s, b) => s + (b.quantidade || 0) * (b.custo_unitario || 0),
      0
    )
  );
  const lucroReal = arredondar(valorAReceber - custoBrindes);
  const saldoPendente = arredondar(Math.max(0, valorAReceber - valorPagoRecebido));
  const quitado = saldoPendente <= 0.009;

  return {
    quantidadeFuros: furos,
    precoFuro,
    valorBruto,
    comissaoPercentual: comissaoPct,
    valorComissao,
    desconto,
    valorAReceber,
    custoBrindes,
    lucroReal,
    valorPagoRecebido,
    saldoPendente,
    quitado,
  };
}
