import {
  estaEmTrial,
  temPagamentoValido,
  type AcessoAssinaturaInput,
} from "@/lib/assinatura-acesso";

/** Banner no app aparece a partir de N dias antes do vencimento. */
export const DIAS_AVISO_VENCIMENTO = 5;

/** Dias (relativos ao vencimento) em que o cron manda push: 3 antes, 1 antes, no dia, 1 depois. */
export const DIAS_PUSH_VENCIMENTO = [3, 1, 0, -1] as const;

const FUSO = "America/Sao_Paulo";

function dataNoFuso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Diferença em dias de calendário (horário de Brasília) entre hoje e a data.
 * 0 = hoje · 1 = amanhã · -1 = ontem.
 */
export function diasCalendarioAte(iso: string | null | undefined, agora = new Date()): number | null {
  if (!iso) return null;
  const alvo = new Date(iso);
  if (!Number.isFinite(alvo.getTime())) return null;
  const [ay, am, ad] = dataNoFuso(alvo).split("-").map(Number);
  const [hy, hm, hd] = dataNoFuso(agora).split("-").map(Number);
  return Math.round((Date.UTC(ay!, am! - 1, ad!) - Date.UTC(hy!, hm! - 1, hd!)) / 86_400_000);
}

export function formatarDataVencimento(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export type StatusVencimento =
  | { tipo: "ok" }
  | { tipo: "vence_em_breve"; dias: number; venceEm: string; renovacaoCancelada: boolean }
  | { tipo: "vencida"; venceEm: string };

export function statusVencimento(p: AcessoAssinaturaInput): StatusVencimento {
  const venceEm = p.assinatura_vence_em;
  if (!venceEm) return { tipo: "ok" };

  if (temPagamentoValido(p)) {
    const dias = diasCalendarioAte(venceEm);
    if (dias == null || dias > DIAS_AVISO_VENCIMENTO) return { tipo: "ok" };
    return {
      tipo: "vence_em_breve",
      dias: Math.max(0, dias),
      venceEm,
      renovacaoCancelada: p.assinatura_ativa === false,
    };
  }

  if (estaEmTrial(p)) return { tipo: "ok" };
  return { tipo: "vencida", venceEm };
}

/** Já teve assinatura paga (para trocar "teste encerrado" por "assinatura vencida"). */
export function jaTeveAssinaturaPaga(p: AcessoAssinaturaInput): boolean {
  return Boolean(p.assinatura_vence_em);
}

export function textoDiasVencimento(dias: number): string {
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}
