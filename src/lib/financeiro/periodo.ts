export type PeriodoFiltro = "hoje" | "7d" | "30d" | "tudo";

export const periodoLabels: Record<PeriodoFiltro, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  tudo: "Tudo",
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dataNoPeriodo(
  dateInput: string | null | undefined,
  periodo: PeriodoFiltro,
  agora = new Date()
): boolean {
  if (periodo === "tudo") return true;
  if (!dateInput) return false;

  const data = startOfDay(new Date(dateInput.includes("T") ? dateInput : `${dateInput}T12:00:00`));
  const hoje = startOfDay(agora);

  if (periodo === "hoje") {
    return data.getTime() === hoje.getTime();
  }

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - (periodo === "7d" ? 7 : 30));
  return data >= limite;
}
