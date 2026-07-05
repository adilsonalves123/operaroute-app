import type { EquipamentoTipo } from "./equipamentos";
import { limiteFromFaixa, normalizeFaixaPontos } from "./pricing";
import type { Nicho } from "./types/database";

export const EQUIPAMENTO_NICHO: Record<EquipamentoTipo, Nicho> = {
  cassino: "maquinas_cassino",
  vending_ursinho: "maquinas_cassino",
  fura_fura: "fura_fura",
};

export function resolveNichosAtivos(
  nichos: Nicho[] | null | undefined,
  fallbackNicho?: Nicho | null
): Nicho[] {
  const set = new Set<Nicho>(nichos ?? []);
  if (fallbackNicho) set.add(fallbackNicho);
  set.add("outros");
  return [...set];
}

export function canUseNicho(nichosAtivos: Nicho[], nicho: Nicho): boolean {
  if (nicho === "outros") return true;
  return nichosAtivos.includes(nicho);
}

export function canUseEquipamentoTipo(
  nichosAtivos: Nicho[],
  tipo: EquipamentoTipo
): boolean {
  return canUseNicho(nichosAtivos, EQUIPAMENTO_NICHO[tipo]);
}

export function filterEquipamentoTiposPorNicho<
  T extends { id: EquipamentoTipo; enabled: boolean },
>(tipos: T[], nichosAtivos?: Nicho[]): T[] {
  return tipos.filter((t) => {
    if (!t.enabled) return false;
    if (!nichosAtivos?.length) return true;
    return canUseEquipamentoTipo(nichosAtivos, t.id);
  });
}

export function getLimitePontos(
  quantidadePontos: string | null | undefined,
  limitePontos?: number | null
): number {
  if (limitePontos && limitePontos > 0) return limitePontos;
  return limiteFromFaixa(normalizeFaixaPontos(quantidadePontos ?? "1-10"));
}

export function canAddPonto(
  pontosAtivos: number,
  quantidadePontos: string | null | undefined,
  limitePontos?: number | null
): boolean {
  return pontosAtivos < getLimitePontos(quantidadePontos, limitePontos);
}
