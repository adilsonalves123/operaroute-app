import type { EquipamentoTipo } from "./equipamentos";
import { limiteFromFaixa, normalizeFaixaPontos } from "./pricing";
import type { Nicho } from "./types/database";

export const EQUIPAMENTO_NICHO: Record<EquipamentoTipo, Nicho> = {
  cassino: "maquinas_cassino",
  ursinho: "ursinho",
  vending_ursinho: "vending_ursinho",
  fura_fura: "fura_fura",
  sinuca: "diversao",
  fliperama: "diversao",
  cadeira_massagem: "diversao",
  diversao: "diversao",
  bolinha: "bolinha",
  consignado: "consignado",
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

/** Nichos exibidos no painel do ponto (sem "outros" quando há cassino/fura). */
export function nichosParaPainelPonto(nichosAtivos: Nicho[]): Nicho[] {
  const principais = nichosAtivos.filter((n) => n !== "outros");
  return principais.length > 0 ? principais : ["outros"];
}

export function filterEquipamentosPorNicho<T extends { tipo: EquipamentoTipo }>(
  equipamentos: T[],
  nicho: Nicho
): T[] {
  if (nicho === "outros") return [];
  return equipamentos.filter((eq) => EQUIPAMENTO_NICHO[eq.tipo] === nicho);
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
