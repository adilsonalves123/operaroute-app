import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CalculoColetaFuraFuraResult } from "./calculo-coleta";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import type { RelatorioCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";

export type RelatorioFuraFuraData = {
  empresaNome: string;
  pontoNome: string;
  pontoWhatsapp?: string | null;
  data: Date;
  previa: boolean;
  calculo: CalculoColetaFuraFuraResult;
  kitNome?: string | null;
  /** Preview/blob ou URL pública da foto da máquina. */
  fotoUrl?: string | null;
  /** Pendência/haver incluídos na cobrança (comprovante detalhado). */
  cobranca?: RelatorioCobrancaDetalhe | null;
};

export function buildRelatorioMensagemWhatsAppFuraFura(data: RelatorioFuraFuraData): string {
  const { calculo: c, pontoNome, empresaNome, previa, kitNome } = data;
  const dataStr = formatDateTime(data.data);
  const linhas = [
    previa ? "⏳ *PRÉVIA — AGUARDANDO PAGAMENTO*" : "✅ *Relatório de Coleta Fura-Fura*",
    `🏢 ${empresaNome}`,
    `📍 ${pontoNome}`,
    `📅 ${dataStr}`,
    "",
  ];
  if (kitNome) linhas.push(`🎁 Kit: ${kitNome}`, "");
  linhas.push(
    `🎯 Furos: ${c.quantidadeFuros} × ${formatCurrency(c.precoFuro)}`,
    `💰 Bruto: ${formatCurrency(c.valorBruto)}`,
    `🏪 Comissão (${c.comissaoPercentual}%): ${formatCurrency(c.valorComissao)}`
  );
  if (c.desconto > 0.009) linhas.push(`🏷 Desconto: ${formatCurrency(c.desconto)}`);
  linhas.push(`✅ A receber: *${formatCurrency(c.valorAReceber)}*`);
  if (c.custoBrindes > 0.009) linhas.push(`🎁 Brindes: ${formatCurrency(c.custoBrindes)}`);
  linhas.push(`📈 Lucro: *${formatCurrency(c.lucroReal)}*`);
  if (c.valorPagoRecebido > 0.009) {
    linhas.push(`💵 Recebido: ${formatCurrency(c.valorPagoRecebido)}`);
  }
  if (c.haver > 0.009) linhas.push(`💳 Haver do ponto: ${formatCurrency(c.haver)}`);
  if (c.saldoPendente > 0.009) {
    linhas.push(`⏳ Pendente: ${formatCurrency(c.saldoPendente)}`);
  }
  linhas.push("", "_OperaRoute_");
  return linhas.join("\n");
}

export function whatsAppUrlFuraFura(telefone: string | null | undefined, mensagem: string): string {
  return whatsAppUrl(telefone, mensagem);
}

export function downloadBlobFuraFura(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
