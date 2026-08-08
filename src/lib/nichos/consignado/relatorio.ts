import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CalculoColetaConsignado, LinhaConsignadoCalculada } from "./index";

export type RelatorioConsignadoExpositor = {
  nome: string;
  linhas: LinhaConsignadoCalculada[];
  valorBruto: number;
  custoProdutos: number;
  lucroReal: number;
  fotoUrl?: string | null;
};

export type RelatorioConsignadoData = {
  empresaNome: string;
  pontoNome: string;
  pontoWhatsapp?: string | null;
  data: Date;
  previa: boolean;
  expositores: RelatorioConsignadoExpositor[];
  calculo: CalculoColetaConsignado;
};

export function buildRelatorioMensagemWhatsAppConsignado(data: RelatorioConsignadoData): string {
  const { calculo: c, pontoNome, empresaNome, previa } = data;
  const dataStr = formatDateTime(data.data);

  const linhas = [
    previa ? "⏳ *PRÉVIA — AGUARDANDO PAGAMENTO*" : "✅ *Relatório de Consignado*",
    `🏢 ${empresaNome}`,
    `📍 ${pontoNome}`,
    `📅 ${dataStr}`,
    "",
  ];

  for (const exp of data.expositores) {
    linhas.push(`*${exp.nome}*`);
    for (const l of exp.linhas) {
      if (l.vendido <= 0) continue;
      const cod = l.codigo ? ` (${l.codigo})` : "";
      linhas.push(
        `• ${l.vendido} × ${l.nome}${cod} — ${formatCurrency(l.precoVenda)} un = ${formatCurrency(l.receita)}`
      );
      if (l.comissao > 0.009) {
        linhas.push(`  Cliente (repasse): ${formatCurrency(l.comissao)}`);
      }
    }
    linhas.push("");
  }

  linhas.push(`💰 Vendido (bruto): ${formatCurrency(c.valorBruto)}`);
  linhas.push(
    c.modoComissao === "tabela"
      ? `🏪 Repasse ao cliente (tabela): ${formatCurrency(c.valorComissao)}`
      : `🏪 Comissão do cliente (${c.comissaoPercentual}%): ${formatCurrency(c.valorComissao)}`
  );

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

export function whatsAppUrlConsignado(telefone: string | null | undefined, mensagem: string): string {
  const digits = String(telefone ?? "").replace(/\D/g, "");
  const numero = digits.startsWith("55") ? digits : digits ? `55${digits}` : "";
  const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}

export function downloadBlobConsignado(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
