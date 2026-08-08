import { monthPeriodLabel } from "@/lib/dashboard-greeting";

export type PeriodoAnalisePreset =
  | "hoje"
  | "semana"
  | "7d"
  | "30d"
  | "mes"
  | "personalizado";

export const periodoAnaliseOpcoes: {
  id: Exclude<PeriodoAnalisePreset, "personalizado">;
  label: string;
}[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Este mês" },
];

/** Filtros do dashboard: dia, semana, mês (+ data específica no seletor). */
export const periodoDashboardOpcoes: {
  id: Exclude<PeriodoAnalisePreset, "personalizado" | "7d" | "30d">;
  label: string;
}[] = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];

export type PeriodoAnaliseRange = {
  preset: PeriodoAnalisePreset;
  inicio: Date;
  fim: Date;
  label: string;
  inicioISO: string;
  fimISO: string;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseDateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatBr(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function parsePeriodoAnalisePreset(raw?: string | null): PeriodoAnalisePreset {
  const p = (raw ?? "mes").toLowerCase();
  if (
    p === "hoje" ||
    p === "semana" ||
    p === "7d" ||
    p === "30d" ||
    p === "mes" ||
    p === "personalizado"
  ) {
    return p;
  }
  return "mes";
}

export function resolverPeriodoAnalise(input?: {
  periodo?: string | null;
  de?: string | null;
  ate?: string | null;
  agora?: Date;
}): PeriodoAnaliseRange {
  const agora = input?.agora ?? new Date();
  const hoje = startOfDay(agora);

  const de = input?.de ? parseDateOnly(input.de) : null;
  const ate = input?.ate ? parseDateOnly(input.ate) : null;
  const presetRaw = parsePeriodoAnalisePreset(input?.periodo);

  if ((presetRaw === "personalizado" || (de && ate)) && de && ate && de.getTime() <= ate.getTime()) {
    const inicio = startOfDay(de);
    const fim = endOfDay(ate);
    const mesmoDia = inicio.toDateString() === startOfDay(ate).toDateString();
    return {
      preset: "personalizado",
      inicio,
      fim,
      label: mesmoDia ? formatBr(inicio) : `${formatBr(inicio)} — ${formatBr(ate)}`,
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
    };
  }

  const preset = presetRaw === "personalizado" ? "mes" : presetRaw;

  let inicio = hoje;
  const fim = endOfDay(agora);
  let label: string;

  switch (preset) {
    case "hoje":
      label = "Hoje";
      break;
    case "semana": {
      const dow = hoje.getDay();
      const diasDesdeSegunda = dow === 0 ? 6 : dow - 1;
      inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - diasDesdeSegunda);
      label = "Esta semana";
      break;
    }
    case "7d":
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 6);
      label = "Últimos 7 dias";
      break;
    case "30d":
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 29);
      label = "Últimos 30 dias";
      break;
    case "mes":
    default:
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      label = monthPeriodLabel();
      break;
  }

  return {
    preset,
    inicio,
    fim,
    label,
    inicioISO: inicio.toISOString(),
    fimISO: fim.toISOString(),
  };
}

export function buildAnaliseSearchParams(
  preset: PeriodoAnalisePreset,
  de?: string,
  ate?: string
): string {
  const params = new URLSearchParams();
  params.set("periodo", preset);
  if (preset === "personalizado" && de && ate) {
    params.set("de", de);
    params.set("ate", ate);
  }
  return params.toString();
}

/** Mesmo comprimento de janela, imediatamente antes de `periodo`. */
export function periodoAnterior(periodo: PeriodoAnaliseRange): PeriodoAnaliseRange {
  const duracaoMs = Math.max(0, periodo.fim.getTime() - periodo.inicio.getTime());
  const fim = new Date(periodo.inicio.getTime() - 1);
  const inicio = new Date(fim.getTime() - duracaoMs);
  const inicioDia = startOfDay(inicio);
  const fimDia = endOfDay(fim);
  return {
    preset: "personalizado",
    inicio: inicioDia,
    fim: fimDia,
    label: `${formatBr(inicioDia)} — ${formatBr(fimDia)}`,
    inicioISO: inicioDia.toISOString(),
    fimISO: fimDia.toISOString(),
  };
}
