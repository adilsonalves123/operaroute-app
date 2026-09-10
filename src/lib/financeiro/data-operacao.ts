/** Fuso operacional do app (caixa, coletas, “hoje”). */
export const TZ_OPERACAO = "America/Sao_Paulo";

/**
 * Data de calendário YYYY-MM-DD no fuso de operação.
 * Evita CURRENT_DATE/UTC do Postgres e toISOString().slice(0,10) no servidor.
 */
export function dataOperacaoBR(agora: Date = new Date()): string {
  return calendarDateInTZ(agora, TZ_OPERACAO);
}

/**
 * Extrai YYYY-MM-DD de um campo DATE do Postgres sem aplicar fuso.
 * Timestamps reais (com hora ≠ 00:00Z) usam o fuso de operação.
 */
export function calendarDateInTZ(
  input: string | Date,
  timeZone: string = TZ_OPERACAO
): string {
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DATE serializado como meia-noite UTC — o dia do calendário é o prefixo
    const midnite = s.match(
      /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.\d+)?(?:Z|[+-]00:00)?$/
    );
    if (midnite) return midnite[1];
  }

  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return d.toISOString().slice(0, 10);
  return `${y}-${m}-${day}`;
}

/**
 * Dia de caixa do lançamento no Brasil.
 * `created_at` é a fonte da verdade (quando o dinheiro entrou).
 * Só respeita `data` quando for backdate explícito (mais de 1 dia antes).
 */
export function diaOperacaoFinanceiro(l: {
  data?: string | null;
  created_at?: string | null;
}): string {
  const criado = l.created_at ? calendarDateInTZ(l.created_at) : "";
  const marcado = l.data ? calendarDateInTZ(l.data) : "";

  if (criado && marcado && marcado < criado) {
    // Lançamento manual datado no passado
    return marcado;
  }
  if (criado) return criado;
  return marcado;
}
