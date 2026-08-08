import { formatCurrency } from "@/lib/utils";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";

export type CobrancaColetaNichoOpts = {
  pontoNome: string;
  nichoLabel: string;
  valorAPagar: number;
  /** Linhas curtas do resumo (já formatadas). */
  linhasResumo?: string[];
  chavePix?: string | null;
  nomeOperacao?: string | null;
  data?: Date;
};

/** Cobrança WhatsApp: resuminho + valor + chave Pix da operação. */
export function mensagemCobrancaColetaNicho(opts: CobrancaColetaNichoOpts): string {
  const dataStr = (opts.data ?? new Date()).toLocaleDateString("pt-BR");
  const linhas = [`Olá! Cobrança — *${opts.pontoNome}* (${opts.nichoLabel})`];

  if (opts.nomeOperacao?.trim()) {
    linhas.push(opts.nomeOperacao.trim());
  }
  linhas.push(`📅 ${dataStr}`, "");

  if (opts.linhasResumo && opts.linhasResumo.length > 0) {
    linhas.push("*Resumo:*");
    for (const l of opts.linhasResumo) {
      linhas.push(`• ${l}`);
    }
    linhas.push("");
  }

  linhas.push(`💰 *Valor a pagar: ${formatCurrency(opts.valorAPagar)}*`);
  linhas.push("");

  const chave = opts.chavePix?.trim();
  if (chave) {
    linhas.push("*Chave Pix para pagamento:*");
    linhas.push(chave);
    linhas.push("");
    linhas.push("Pode enviar o Pix e me avisar, por favor?");
  } else {
    linhas.push("Me avise para eu passar a chave Pix.");
  }

  return linhas.join("\n");
}

export function linkWhatsAppCobrancaColetaNicho(
  telefone: string | null | undefined,
  opts: CobrancaColetaNichoOpts
): string | null {
  if (opts.valorAPagar <= 0.009) return null;
  return whatsAppUrl(telefone, mensagemCobrancaColetaNicho(opts));
}
