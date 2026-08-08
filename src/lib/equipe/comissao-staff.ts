/** Comissão do operador/gerente: % sobre lucro após desconto de brindes (lucro_real). */

export function clampComissaoPercentual(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function calcComissaoStaff(
  lucroAposBrindes: number,
  percentual: number
): number {
  const lucro = Number(lucroAposBrindes);
  const pct = clampComissaoPercentual(percentual);
  if (!Number.isFinite(lucro) || lucro <= 0 || pct <= 0) return 0;
  return Math.round(lucro * pct) / 100;
}
