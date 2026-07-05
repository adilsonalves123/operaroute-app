import type { BrindeEntregue, CalculoColetaFuraFuraResult } from "./calculo-coleta";
import { calcularColetaFuraFura } from "./calculo-coleta";

type ColetaSalva = {
  quantidade_furos?: number | null;
  preco_furo?: number | null;
  comissao_percentual?: number | null;
  desconto?: number | null;
  valor_bruto?: number | null;
  valor_comissao?: number | null;
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
  custo_brindes?: number | null;
  lucro_real?: number | null;
  valor_liquido?: number | null;
  brindes_entregues?: unknown;
};

export function parseBrindesSalvos(raw: unknown): BrindeEntregue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => ({
      item_id: typeof b.item_id === "string" ? b.item_id : undefined,
      nome: String(b.nome ?? "Brinde"),
      quantidade: Math.max(0, Math.floor(Number(b.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(b.custo_unitario) || 0),
    }))
    .filter((b) => b.quantidade > 0);
}

/** Reconstrói o cálculo a partir dos campos salvos (detalhe da coleta). */
export function calculoFromColetaSalva(coleta: ColetaSalva): CalculoColetaFuraFuraResult {
  const brindes = parseBrindesSalvos(coleta.brindes_entregues);
  const recalculado = calcularColetaFuraFura({
    quantidadeFuros: Number(coleta.quantidade_furos ?? 0),
    precoFuro: Number(coleta.preco_furo ?? 1),
    comissaoPercentual: Number(coleta.comissao_percentual ?? 0),
    desconto: Number(coleta.desconto ?? 0),
    brindes,
    valorPagoRecebido: Number(coleta.valor_pago_recebido ?? 0),
  });

  if (coleta.lucro_real != null || coleta.valor_a_receber != null) {
    const valorAReceber = Number(coleta.valor_a_receber ?? recalculado.valorAReceber);
    const valorPago = Number(coleta.valor_pago_recebido ?? 0);
    const saldoPendente = Math.max(0, Math.round((valorAReceber - valorPago) * 100) / 100);
    return {
      ...recalculado,
      valorBruto: Number(coleta.valor_bruto ?? recalculado.valorBruto),
      valorComissao: Number(coleta.valor_comissao ?? recalculado.valorComissao),
      valorAReceber,
      custoBrindes: Number(coleta.custo_brindes ?? recalculado.custoBrindes),
      lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? recalculado.lucroReal),
      valorPagoRecebido: valorPago,
      saldoPendente,
      quitado: saldoPendente <= 0.009,
    };
  }

  return recalculado;
}

export type ComparativoMes = {
  lucroReal: number;
  totalBruto: number;
  coletas: number;
  furos: number;
};

export function deltaPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0.009) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}
