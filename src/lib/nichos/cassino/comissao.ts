import type { CalculoVisitaResult } from "./types";

/** Percentual de comissão do ponto (0–100). */
export function parseComissaoPercentual(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lucro restante após abater negativo/haver — base da comissão. */
export function baseComissaoReais(c: CalculoVisitaResult): number {
  return c.saldoAposDebitoReais;
}

/** Comissão não incide — visita negativa ou lucro insuficiente após haver/negativo. */
export function comissaoBloqueada(c: CalculoVisitaResult): boolean {
  if (c.saldoNegativo) return true;
  return !c.comissaoAplicada;
}
