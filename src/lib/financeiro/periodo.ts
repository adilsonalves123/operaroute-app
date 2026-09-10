import { calendarDateInTZ, dataOperacaoBR, TZ_OPERACAO } from "@/lib/financeiro/data-operacao";

export type PeriodoFiltro = "hoje" | "7d" | "30d" | "tudo";

export const periodoLabels: Record<PeriodoFiltro, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  tudo: "Tudo",
};

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0, 0);
  return dataOperacaoBR(dt);
}

/**
 * Compara datas de calendário em America/Sao_Paulo.
 * DATE puro ("2026-09-09") não sofre shift de fuso; timestamps usam o dia no Brasil.
 */
export function dataNoPeriodo(
  dateInput: string | null | undefined,
  periodo: PeriodoFiltro,
  agora = new Date()
): boolean {
  if (periodo === "tudo") return true;
  if (!dateInput) return false;

  const data = calendarDateInTZ(dateInput, TZ_OPERACAO);
  const hoje = dataOperacaoBR(agora);

  if (periodo === "hoje") {
    return data === hoje;
  }

  // Inclusivo: "7 dias" = hoje + 6 anteriores (igual Análise).
  const limite = addDaysISO(hoje, periodo === "7d" ? -6 : -29);
  return data >= limite;
}
