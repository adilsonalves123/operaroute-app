import type { Nicho } from "./types/database";

export type FaixaPontos = "1-10" | "11-30" | "31-60" | "61-100" | "100+";

export const FAIXAS_PONTOS: { id: FaixaPontos; label: string; limite: number }[] = [
  { id: "1-10", label: "1–10 pontos", limite: 10 },
  { id: "11-30", label: "11–30 pontos", limite: 30 },
  { id: "31-60", label: "31–60 pontos", limite: 60 },
  { id: "61-100", label: "61–100 pontos", limite: 100 },
  { id: "100+", label: "100+ pontos", limite: 9999 },
];

/** Nichos com módulo de regras completo — entram no cálculo do preço */
export const NICHOS_PAGOS: Nicho[] = ["fura_fura", "maquinas_cassino"];

/** Matriz mensal (R$): faixa de pontos × quantidade de nichos pagos */
export const PRICING_MATRIX: Record<FaixaPontos, Record<1 | 2 | 3, number | null>> = {
  "1-10": { 1: 79, 2: 119, 3: 149 },
  "11-30": { 1: 129, 2: 179, 3: 219 },
  "31-60": { 1: 199, 2: 259, 3: 299 },
  "61-100": { 1: 279, 2: 349, 3: 399 },
  "100+": { 1: null, 2: null, 3: null },
};

const LEGACY_FAIXA_MAP: Record<string, FaixaPontos> = {
  "11-50": "11-30",
  "51-100": "61-100",
};

export function normalizeFaixaPontos(value: string | null | undefined): FaixaPontos {
  if (!value) return "1-10";
  if (value in PRICING_MATRIX) return value as FaixaPontos;
  return LEGACY_FAIXA_MAP[value] ?? "1-10";
}

export function limiteFromFaixa(faixa: FaixaPontos | string): number {
  const id = normalizeFaixaPontos(faixa);
  return FAIXAS_PONTOS.find((f) => f.id === id)?.limite ?? 10;
}

export function countNichosPagos(nichos: Nicho[]): number {
  const pagos = nichos.filter((n) => NICHOS_PAGOS.includes(n));
  return Math.max(1, pagos.length);
}

export function calcPrecoMensal(
  faixa: FaixaPontos | string,
  nichos: Nicho[]
): number | null {
  const faixaId = normalizeFaixaPontos(faixa);
  const tier = Math.min(3, countNichosPagos(nichos)) as 1 | 2 | 3;
  return PRICING_MATRIX[faixaId][tier];
}

export function formatPreco(preco: number | null): string {
  if (preco === null) return "Sob consulta";
  return `R$ ${preco}/mês`;
}
