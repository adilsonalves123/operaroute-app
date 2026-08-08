import type { Nicho } from "@/lib/types/database";

/** Chaves de comissão por nicho (armazenadas em pontos.comissao_por_nicho). */
export const NICHOS_COMISSAO = [
  "maquinas_cassino",
  "fura_fura",
  "ursinho",
  "diversao",
  "bolinha",
  "consignado",
] as const;

export type NichoComissaoKey = (typeof NICHOS_COMISSAO)[number];

export const LABEL_COMISSAO_NICHO: Record<NichoComissaoKey, string> = {
  maquinas_cassino: "Cassino",
  fura_fura: "Fura Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

export type PontoComissaoSource = {
  comissao_percentual?: number | null;
  comissao_por_nicho?: unknown;
};

export function chaveComissaoNicho(nicho: string): NichoComissaoKey | null {
  if (nicho === "cassino" || nicho === "maquinas_cassino") return "maquinas_cassino";
  if (nicho === "vending_ursinho") return "ursinho";
  if ((NICHOS_COMISSAO as readonly string[]).includes(nicho)) {
    return nicho as NichoComissaoKey;
  }
  return null;
}

export function parseComissaoPorNicho(raw: unknown): Partial<Record<NichoComissaoKey, number>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<NichoComissaoKey, number>> = {};
  for (const key of NICHOS_COMISSAO) {
    const v = (raw as Record<string, unknown>)[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[key] = Math.max(0, Math.min(100, n));
  }
  return out;
}

/**
 * % de comissão do nicho neste ponto.
 * - Se houver valor em comissao_por_nicho[nicho], usa ele.
 * - Consignado sem valor → 0 (não herda o % do cassino/fura).
 * - Demais nichos sem valor → fallback em comissao_percentual (legado).
 */
export function getComissaoPercentualNicho(
  ponto: PontoComissaoSource | null | undefined,
  nicho: NichoComissaoKey | string
): number {
  const key = chaveComissaoNicho(String(nicho));
  if (!key) return Math.max(0, Number(ponto?.comissao_percentual) || 0);

  const map = parseComissaoPorNicho(ponto?.comissao_por_nicho);
  if (map[key] != null) return map[key]!;

  if (key === "consignado") return 0;
  return Math.max(0, Number(ponto?.comissao_percentual) || 0);
}

/** Monta o mapa completo a partir do form (só nichos ativos). */
export function buildComissaoPorNichoPayload(
  values: Partial<Record<NichoComissaoKey, string | number>>,
  nichosAtivos?: Nicho[]
): Record<string, number> {
  const keys = nichosComissaoVisiveis(nichosAtivos);
  const out: Record<string, number> = {};
  for (const key of keys) {
    out[key] = Math.max(0, Math.min(100, Number(values[key]) || 0));
  }
  // Garante consignado sempre presente se estiver no form (mesmo fora da lista)
  if (values.consignado != null && out.consignado == null) {
    out.consignado = Math.max(0, Math.min(100, Number(values.consignado) || 0));
  }
  return out;
}

/** Niche keys to show in ponto UI given empresa niches. */
export function nichosComissaoVisiveis(nichosAtivos?: Nicho[]): NichoComissaoKey[] {
  if (!nichosAtivos?.length) return [...NICHOS_COMISSAO];
  const keys = new Set<NichoComissaoKey>();
  for (const n of nichosAtivos) {
    const k = chaveComissaoNicho(n);
    if (k) keys.add(k);
  }
  return NICHOS_COMISSAO.filter((k) => keys.has(k));
}
