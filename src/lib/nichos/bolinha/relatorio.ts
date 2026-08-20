import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CalculoColetaBolinha } from "./index";
import type { RelatorioCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";

export type RelatorioBolinhaMaquina = {
  nome: string;
  valorContado: number;
  precoJogada: number;
  unidadesSaiu: number;
  entradaAnterior: number;
  entradaAtual: number;
  entradaPeriodo: number;
  valorBruto: number;
  custoBrindes: number;
  lucroReal: number;
  fotoUrl?: string | null;
};

export type RelatorioBolinhaData = {
  empresaNome: string;
  pontoNome: string;
  pontoWhatsapp?: string | null;
  comissaoPercentual: number;
  data: Date;
  previa: boolean;
  maquinas: RelatorioBolinhaMaquina[];
  calculo: CalculoColetaBolinha;
  cobranca?: RelatorioCobrancaDetalhe | null;
};

export function buildRelatorioMensagemWhatsAppBolinha(data: RelatorioBolinhaData): string {
  const { calculo: c, pontoNome, empresaNome, previa } = data;
  const dataStr = formatDateTime(data.data);

  const linhas = [
    previa ? "⏳ *PRÉVIA — AGUARDANDO PAGAMENTO*" : "✅ *Relatório de Coleta Bolinha*",
    `🏢 ${empresaNome}`,
    `📍 ${pontoNome}`,
    `📅 ${dataStr}`,
    "",
    "*Máquinas:*",
    ...data.maquinas.map((m) => {
      const partes = [
        `• ${m.nome}`,
        `  Contado: ${formatCurrency(m.valorContado)} · Jogada ${formatCurrency(m.precoJogada)} · Saiu ${m.unidadesSaiu}`,
        `  Bruto: ${formatCurrency(m.valorBruto)}`,
      ];
      return partes.join("\n");
    }),
    "",
    `💰 Bruto total: ${formatCurrency(c.valorBruto)}`,
    `🏪 Comissão (${c.comissaoPercentual}%): ${formatCurrency(c.valorComissao)}`,
  ];

  if (c.desconto > 0.009) {
    linhas.push(`🏷 Desconto: ${formatCurrency(c.desconto)}`);
  }

  linhas.push(`✅ A receber: *${formatCurrency(c.valorAReceber)}*`);

  if (c.valorPagoRecebido > 0.009) {
    linhas.push(`💵 Recebido: ${formatCurrency(c.valorPagoRecebido)}`);
  }
  if (c.haver > 0.009) {
    linhas.push(`💳 Haver do ponto: ${formatCurrency(c.haver)}`);
  }
  if (c.saldoPendente > 0.009) {
    linhas.push(`⏳ Pendente: ${formatCurrency(c.saldoPendente)}`);
  }

  linhas.push("", "_OperaRoute_");
  return linhas.join("\n");
}

export function whatsAppUrlBolinha(telefone: string | null | undefined, mensagem: string): string {
  const digits = String(telefone ?? "").replace(/\D/g, "");
  const numero = digits.startsWith("55") ? digits : digits ? `55${digits}` : "";
  const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}

export function downloadBlobBolinha(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
