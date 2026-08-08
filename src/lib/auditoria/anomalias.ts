import type { AuditoriaSeveridade } from "@/lib/auditoria/types";

export type AnomaliaDetectada = {
  codigo: string;
  severidade: AuditoriaSeveridade;
  titulo: string;
  resumo: string;
  meta?: Record<string, unknown>;
};

/** Contadores que diminuíram = leitura / edição suspeita. */
export function detectarContadorRegressivo(input: {
  label: string;
  anterior: number | null | undefined;
  atual: number | null | undefined;
  campo: string;
}): AnomaliaDetectada | null {
  if (input.anterior == null || input.atual == null) return null;
  const ant = Number(input.anterior);
  const atu = Number(input.atual);
  if (!Number.isFinite(ant) || !Number.isFinite(atu)) return null;
  if (atu >= ant) return null;

  const delta = ant - atu;
  return {
    codigo: "contador_regressivo",
    severidade: "critical",
    titulo: `Contador ${input.label} diminuiu`,
    resumo: `${input.label}: ${ant} → ${atu} (caiu ${delta}). Possível erro de leitura ou edição manual.`,
    meta: { campo: input.campo, anterior: ant, atual: atu, delta },
  };
}

export function detectarSaltoContador(input: {
  label: string;
  anterior: number | null | undefined;
  atual: number | null | undefined;
  campo: string;
  /** Limite em unidades do contador (centésimos no cassino). Default ~R$ 50.000 */
  limite?: number;
}): AnomaliaDetectada | null {
  if (input.anterior == null || input.atual == null) return null;
  const ant = Number(input.anterior);
  const atu = Number(input.atual);
  if (!Number.isFinite(ant) || !Number.isFinite(atu) || atu <= ant) return null;
  const limite = input.limite ?? 5_000_000;
  const delta = atu - ant;
  if (delta < limite) return null;

  return {
    codigo: "contador_salto",
    severidade: "high",
    titulo: `Salto alto em ${input.label}`,
    resumo: `${input.label} subiu ${delta} de uma vez. Revise se a leitura está correta.`,
    meta: { campo: input.campo, anterior: ant, atual: atu, delta },
  };
}

export function detectarDiffFinanceiro(input: {
  esperado: number;
  gravado: number;
  tolerancia?: number;
  contexto: string;
}): AnomaliaDetectada | null {
  const tol = input.tolerancia ?? 0.02;
  const diff = Math.abs(Number(input.esperado) - Number(input.gravado));
  if (!Number.isFinite(diff) || diff <= tol) return null;

  return {
    codigo: "financeiro_divergente",
    severidade: diff > 50 ? "critical" : "high",
    titulo: "Divergência nas contas",
    resumo: `${input.contexto}: esperado ${input.esperado.toFixed(2)} · gravado ${input.gravado.toFixed(2)} · diferença ${diff.toFixed(2)}.`,
    meta: {
      esperado: input.esperado,
      gravado: input.gravado,
      diferenca: diff,
    },
  };
}
