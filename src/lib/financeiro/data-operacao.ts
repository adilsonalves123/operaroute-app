/** Fuso operacional do app (caixa, coletas, “hoje”). */
export const TZ_OPERACAO = "America/Sao_Paulo";

/**
 * Data de calendário YYYY-MM-DD no fuso de operação.
 * Evita CURRENT_DATE/UTC do Postgres e toISOString().slice(0,10) no servidor.
 */
export function dataOperacaoBR(agora: Date = new Date()): string {
  return calendarDateInTZ(agora, TZ_OPERACAO);
}

export function calendarDateInTZ(
  input: string | Date,
  timeZone: string = TZ_OPERACAO
): string {
  const d =
    typeof input === "string"
      ? parseDateInput(input)
      : input;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) {
    const iso = d.toISOString().slice(0, 10);
    return iso;
  }
  return `${y}-${m}-${day}`;
}

/** Interpreta DATE puro sem deslocar o dia; timestamps usam o instante real. */
function parseDateInput(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  return new Date(s.includes("T") ? s : `${s}T12:00:00`);
}

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0, 0);
  return dataOperacaoBR(dt);
}

/**
 * Dia de caixa do lançamento no Brasil.
 * Corrige o bug em que CURRENT_DATE (UTC) gravou o dia seguinte após 21h BRT.
 */
export function diaOperacaoFinanceiro(l: {
  data?: string | null;
  created_at?: string | null;
}): string {
  const criado = l.created_at ? calendarDateInTZ(l.created_at) : null;
  const marcado = l.data ? calendarDateInTZ(l.data) : null;
  if (criado && marcado && marcado === addDaysISO(criado, 1)) {
    return criado;
  }
  return marcado ?? criado ?? "";
}

