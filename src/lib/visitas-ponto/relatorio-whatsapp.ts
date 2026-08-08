import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import {
  totaisComprovanteVisita,
  valorNichoComprovante,
} from "@/lib/visitas-ponto/comprovante-totais";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import { formatCurrency } from "@/lib/utils";

export type OpcoesMensagemVisitaPonto = {
  dividaSaldo?: number;
  desconto?: number;
  pix?: number;
  dinheiro?: number;
  previa?: boolean;
  /** Chave Pix da operação (cobrança). */
  chavePix?: string | null;
  nomeOperacao?: string | null;
  haverSaldo?: number;
  descontarHaver?: boolean;
};

export function mensagemWhatsAppVisitaPonto(
  resumo: VisitaPontoResumo,
  opts: OpcoesMensagemVisitaPonto = {}
): string {
  const dataStr = new Date(
    resumo.finalizadaEm ?? resumo.createdAt
  ).toLocaleDateString("pt-BR");

  const totais = totaisComprovanteVisita(resumo, {
    dividaSaldo: opts.dividaSaldo ?? 0,
    desconto: opts.desconto,
    pix: opts.pix,
    dinheiro: opts.dinheiro,
    haverSaldo: opts.haverSaldo,
    descontarHaver: opts.descontarHaver,
  });

  const linhas = [
    opts.previa
      ? `📋 *Prévia — Visita ao ponto — ${resumo.pontoNome}*`
      : `📋 *Visita ao ponto — ${resumo.pontoNome}*`,
    `📅 ${dataStr}`,
    "",
  ];

  if (resumo.nichos.length > 0) {
    linhas.push("*Coletas desta visita:*");
    for (const n of resumo.nichos) {
      linhas.push(`• ${n.label}: ${formatCurrency(valorNichoComprovante(n))}`);
    }
    linhas.push("");
  }

  if (totais.dividaSaldo > 0.009) {
    linhas.push(`⚠️ Dívida anterior: ${formatCurrency(totais.dividaSaldo)}`);
    if ((resumo.dividaRecebidaInicio ?? 0) > 0.009) {
      linhas.push(
        `   (− recebido no início: ${formatCurrency(resumo.dividaRecebidaInicio!)})`
      );
    }
  }

  linhas.push(`Subtotal visita: ${formatCurrency(totais.subtotal)}`);

  if (totais.desconto > 0.009) {
    linhas.push(`🏷 Desconto: − ${formatCurrency(totais.desconto)}`);
  }
  if (totais.haverAbatido > 0.009) {
    linhas.push(`💠 Haver descontado: − ${formatCurrency(totais.haverAbatido)}`);
  }

  linhas.push(`💰 *Total a cobrar: ${formatCurrency(totais.totalACobrar)}*`);

  if (totais.valorPago > 0.009) {
    linhas.push(`✅ Pago hoje: ${formatCurrency(totais.valorPago)}`);
  }

  if (totais.restante > 0.009) {
    linhas.push(`⏳ Ainda deve: ${formatCurrency(totais.restante)}`);
  } else if (totais.valorPago > 0.009 && !opts.previa) {
    linhas.push("✅ Quitado");
  }

  if (totais.haverGerado > 0.009) {
    linhas.push(`💠 Haver gerado: + ${formatCurrency(totais.haverGerado)}`);
  }

  if (resumo.cassinoNegativo) {
    linhas.push("");
    linhas.push("*Cassino negativo (fora da cobrança):*");
    linhas.push(
      `• Operação: ${formatCurrency(resumo.cassinoNegativo.valorOperacao)}`
    );
  }

  if (opts.previa) {
    linhas.push("");
    linhas.push("_Prévia antes de finalizar a visita._");
  }

  return linhas.join("\n");
}

/** Mensagem curta de cobrança: resumo + valor a pagar + chave Pix. */
export function mensagemCobrancaVisitaPonto(
  resumo: VisitaPontoResumo,
  opts: OpcoesMensagemVisitaPonto = {}
): string {
  const dataStr = new Date(
    resumo.finalizadaEm ?? resumo.createdAt
  ).toLocaleDateString("pt-BR");

  const totais = totaisComprovanteVisita(resumo, {
    dividaSaldo: opts.dividaSaldo ?? 0,
    desconto: opts.desconto,
    pix: opts.pix,
    dinheiro: opts.dinheiro,
    haverSaldo: opts.haverSaldo,
    descontarHaver: opts.descontarHaver,
  });

  const valorAPagar =
    totais.restante > 0.009 ? totais.restante : totais.totalACobrar;

  const linhas = [
    `Olá! Cobrança da visita — *${resumo.pontoNome}*`,
  ];
  if (opts.nomeOperacao?.trim()) {
    linhas.push(opts.nomeOperacao.trim());
  }
  linhas.push(`📅 ${dataStr}`, "");

  if (resumo.nichos.length > 0) {
    linhas.push("*Resumo das coletas:*");
    for (const n of resumo.nichos) {
      linhas.push(`• ${n.label}: ${formatCurrency(valorNichoComprovante(n))}`);
    }
    linhas.push("");
  }

  if (totais.dividaSaldo > 0.009) {
    linhas.push(`Dívida anterior: ${formatCurrency(totais.dividaSaldo)}`);
  }
  if (totais.desconto > 0.009) {
    linhas.push(`Desconto: − ${formatCurrency(totais.desconto)}`);
  }
  if (totais.haverAbatido > 0.009) {
    linhas.push(`Haver descontado: − ${formatCurrency(totais.haverAbatido)}`);
  }
  if (totais.valorPago > 0.009) {
    linhas.push(`Pago hoje: ${formatCurrency(totais.valorPago)}`);
  }
  if (totais.restante > 0.009) {
    linhas.push(`Ainda deve: ${formatCurrency(totais.restante)}`);
  }

  linhas.push(`💰 *Valor a pagar: ${formatCurrency(valorAPagar)}*`);
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

export function linkWhatsAppCobrancaVisitaPonto(
  telefone: string | null | undefined,
  resumo: VisitaPontoResumo,
  opts?: OpcoesMensagemVisitaPonto
): string | null {
  const totais = totaisComprovanteVisita(resumo, {
    dividaSaldo: opts?.dividaSaldo ?? 0,
    desconto: opts?.desconto,
    pix: opts?.pix,
    dinheiro: opts?.dinheiro,
    haverSaldo: opts?.haverSaldo,
    descontarHaver: opts?.descontarHaver,
  });
  const valorAPagar = totais.restante > 0.009 ? totais.restante : totais.totalACobrar;
  if (valorAPagar <= 0.009) return null;
  const msg = mensagemCobrancaVisitaPonto(resumo, opts);
  if (!msg.trim()) return null;
  return whatsAppUrl(telefone, msg);
}

export function linkWhatsAppVisitaPonto(
  telefone: string | null | undefined,
  resumo: VisitaPontoResumo,
  opts?: OpcoesMensagemVisitaPonto
): string | null {
  const msg = mensagemWhatsAppVisitaPonto(resumo, opts);
  if (!msg.trim()) return null;
  return whatsAppUrl(telefone, msg);
}
