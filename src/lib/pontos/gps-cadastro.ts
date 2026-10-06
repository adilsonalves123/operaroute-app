/** Campo vazio vira null. Number(null) é 0, e 0,0 cai no oceano ao lado da África. */
export function gpsParaSalvar(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}
