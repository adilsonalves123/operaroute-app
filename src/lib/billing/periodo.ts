export type CicloCobranca = "mensal" | "anual";

/** Soma meses sem transbordar: 31/01 + 1 mês = 28/02 (ou 29/02), não 03/03. */
export function somarMeses(from: Date, meses: number): Date {
  const d = new Date(from);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d;
}

export function calcVencimentoAssinatura(ciclo: CicloCobranca, from = new Date()): Date {
  return somarMeses(from, ciclo === "anual" ? 12 : 1);
}

/**
 * Novo vencimento após um pagamento. Renovação antecipada soma ao período que o
 * cliente ainda tem; vencida (ou primeira compra) conta a partir de agora.
 */
export function calcNovoVencimento(
  ciclo: CicloCobranca,
  venceAtualIso: string | null | undefined,
  agora = new Date()
): Date {
  const venceAtual = venceAtualIso ? new Date(venceAtualIso) : null;
  const base =
    venceAtual && Number.isFinite(venceAtual.getTime()) && venceAtual.getTime() > agora.getTime()
      ? venceAtual
      : agora;
  return calcVencimentoAssinatura(ciclo, base);
}
