import { calendarDateInTZ, dataOperacaoBR, TZ_OPERACAO } from "@/lib/financeiro/data-operacao";
export { diaOperacaoFinanceiro } from "@/lib/financeiro/data-operacao";

export type PeriodoFiltro = "hoje" | "7d" | "30d" | "periodo";

export const periodoLabels: Record<PeriodoFiltro, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  periodo: "Período",
};

export type PeriodoRange = {
  de?: string | null;
  ate?: string | null;
};

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0, 0);
  return dataOperacaoBR(dt);
}

function isISODate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Defaults úteis ao abrir o filtro Período (últimos 30 dias no BR). */
export function rangePeriodoPadrao(agora = new Date()): { de: string; ate: string } {
  const ate = dataOperacaoBR(agora);
  return { de: addDaysISO(ate, -29), ate };
}

export function labelPeriodoFiltro(
  periodo: PeriodoFiltro,
  range?: PeriodoRange
): string {
  if (periodo !== "periodo") return periodoLabels[periodo];
  const { de, ate } = normalizarRange(range);
  if (!de && !ate) return "Período";
  if (de && ate) {
    const [dy, dm, dd] = de.split("-");
    const [ay, am, ad] = ate.split("-");
    return `${dd}/${dm}/${dy} – ${ad}/${am}/${ay}`;
  }
  if (de) {
    const [y, m, d] = de.split("-");
    return `A partir de ${d}/${m}/${y}`;
  }
  const [y, m, d] = ate!.split("-");
  return `Até ${d}/${m}/${y}`;
}

function normalizarRange(range?: PeriodoRange): { de: string | null; ate: string | null } {
  const de = isISODate(range?.de) ? range!.de! : null;
  const ate = isISODate(range?.ate) ? range!.ate! : null;
  if (de && ate && de > ate) return { de: ate, ate: de };
  return { de, ate };
}

/**
 * Compara datas de calendário em America/Sao_Paulo.
 * DATE puro ("2026-09-09") não sofre shift de fuso; timestamps usam o dia no Brasil.
 */
export function dataNoPeriodo(
  dateInput: string | null | undefined,
  periodo: PeriodoFiltro,
  range?: PeriodoRange,
  agora = new Date()
): boolean {
  if (!dateInput) return false;

  const data = calendarDateInTZ(dateInput, TZ_OPERACAO);
  const hoje = dataOperacaoBR(agora);

  if (periodo === "hoje") {
    return data === hoje;
  }

  if (periodo === "7d" || periodo === "30d") {
    const limite = addDaysISO(hoje, periodo === "7d" ? -6 : -29);
    return data >= limite;
  }

  // Período personalizado
  const { de, ate } = normalizarRange(range);
  if (!de && !ate) return true;
  if (de && data < de) return false;
  if (ate && data > ate) return false;
  return true;
}
