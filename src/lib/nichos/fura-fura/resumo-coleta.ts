import type { CalculoColetaFuraFuraResult } from "./calculo-coleta";
import { formatCurrency } from "@/lib/utils";

export function resumoColetaFuraFura(calculo: CalculoColetaFuraFuraResult) {
  return {
    linhas: [
      { label: `${calculo.quantidadeFuros} furos × ${formatCurrency(calculo.precoFuro)}`, valor: calculo.valorBruto },
      { label: `Comissão (${calculo.comissaoPercentual}%)`, valor: -calculo.valorComissao },
      ...(calculo.desconto > 0 ? [{ label: "Desconto", valor: -calculo.desconto }] : []),
      { label: "A receber", valor: calculo.valorAReceber, destaque: true },
      ...(calculo.custoBrindes > 0
        ? [{ label: "Custo brindes", valor: -calculo.custoBrindes }]
        : []),
      { label: "Lucro real", valor: calculo.lucroReal, lucro: true },
    ],
    valorAReceber: calculo.valorAReceber,
    valorPago: calculo.valorPagoRecebido,
    saldoPendente: calculo.saldoPendente,
    quitado: calculo.quitado,
    lucroReal: calculo.lucroReal,
  };
}

export function mensagemWhatsAppColeta(
  pontoNome: string,
  calculo: CalculoColetaFuraFuraResult,
  data: Date = new Date()
): string {
  const dataStr = data.toLocaleDateString("pt-BR");
  const linhas = [
    `📋 *Coleta Fura-Fura — ${pontoNome}*`,
    `📅 ${dataStr}`,
    "",
    `🎯 Furos: ${calculo.quantidadeFuros}`,
    `💰 Bruto: ${formatCurrency(calculo.valorBruto)}`,
    `🏪 Comissão: ${formatCurrency(calculo.valorComissao)} (${calculo.comissaoPercentual}%)`,
  ];
  if (calculo.desconto > 0) linhas.push(`🏷 Desconto: ${formatCurrency(calculo.desconto)}`);
  linhas.push(`✅ A receber: *${formatCurrency(calculo.valorAReceber)}*`);
  if (calculo.custoBrindes > 0) linhas.push(`🎁 Brindes: ${formatCurrency(calculo.custoBrindes)}`);
  linhas.push(`📈 Lucro real: *${formatCurrency(calculo.lucroReal)}*`);
  if (calculo.valorPagoRecebido > 0) {
    linhas.push(`💵 Recebido: ${formatCurrency(calculo.valorPagoRecebido)}`);
  }
  if (calculo.saldoPendente > 0.009) {
    linhas.push(`⏳ Pendente: ${formatCurrency(calculo.saldoPendente)}`);
  }
  return linhas.join("\n");
}
