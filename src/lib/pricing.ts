import type { Nicho } from "./types/database";

/** IDs de plano = faixa de pontos (chave em empresas.quantidade_pontos) */
export type FaixaPontos = "1-10" | "11-50" | "51-100" | "100+";

export type PlanoDefinicao = {
  id: FaixaPontos;
  /** slug em empresas.plano (start/growth/pro/elite) */
  slug: "start" | "growth" | "pro" | "elite";
  nome: string;
  descricao: string;
  /** Bullets exibidos na página /planos (só UI). */
  beneficios: string[];
  /** Planos a partir de R$ 499 — Inteligência Artificial. */
  incluiIa: boolean;
  labelPontos: string;
  limitePontos: number;
  maxNichos: number;
  precoMensal: number;
  destaque?: boolean;
};

/** Catálogo padrão — editável no painel do dono */
export const PLANOS_PADRAO: PlanoDefinicao[] = [
  {
    id: "1-10",
    slug: "start",
    nome: "Start",
    descricao: "De 1 a 10 pontos, até 10 equipamentos, painel simples.",
    beneficios: [
      "De 1 a 10 pontos",
      "Até 10 equipamentos",
      "Até 1 nicho na rota",
      "Painel simples e direto",
      "Coletas, pendências e fechamento",
    ],
    incluiIa: false,
    labelPontos: "1–10 pontos",
    limitePontos: 10,
    maxNichos: 1,
    precoMensal: 99.9,
  },
  {
    id: "11-50",
    slug: "growth",
    nome: "Growth",
    descricao: "De 11 a 50 pontos, até 50 equipamentos, operação em crescimento.",
    beneficios: [
      "De 11 a 50 pontos",
      "Até 50 equipamentos",
      "Até 3 nichos na rota",
      "Painel completo da operação",
      "Equipe e visão por operador",
    ],
    incluiIa: false,
    labelPontos: "11–50 pontos",
    limitePontos: 50,
    maxNichos: 3,
    precoMensal: 259.9,
    destaque: true,
  },
  {
    id: "51-100",
    slug: "pro",
    nome: "Pro",
    descricao: "De 51 a 100 pontos, escala com Inteligência Artificial.",
    beneficios: [
      "De 51 a 100 pontos",
      "Até 100 equipamentos",
      "Até 6 nichos na rota",
      "Inteligência Artificial liberada",
      "Análise e insights da operação",
    ],
    incluiIa: true,
    labelPontos: "51–100 pontos",
    limitePontos: 100,
    maxNichos: 6,
    precoMensal: 499,
  },
  {
    id: "100+",
    slug: "elite",
    nome: "Elite",
    descricao: "Pontos e nichos ilimitados — o plano mais completo.",
    beneficios: [
      "Pontos ilimitados",
      "Equipamentos ilimitados",
      "Todos os nichos que quiser",
      "Inteligência Artificial liberada",
      "Prioridade no suporte",
    ],
    incluiIa: true,
    labelPontos: "Ilimitado",
    limitePontos: 9999,
    maxNichos: 6,
    precoMensal: 799,
  },
];

/** IA liberada em planos a partir de R$ 499 (ou flag do catálogo). */
export function planoIncluiIa(plano: Pick<PlanoDefinicao, "incluiIa" | "precoMensal">): boolean {
  return Boolean(plano.incluiIa) || plano.precoMensal >= 499;
}

/** Label da régua / card — segue o limite salvo no painel do dono. */
export function labelPontosDoPlano(
  plano: Pick<PlanoDefinicao, "slug" | "limitePontos" | "id">
): string {
  if (plano.slug === "elite" || plano.limitePontos >= 9999) return "Ilimitado";
  return `Até ${plano.limitePontos} pontos`;
}

/**
 * Bullets da página /planos — sempre derivados do catálogo atual
 * (não usa texto antigo hardcoded se o dono mudou limite/nichos).
 */
export function montarBeneficiosPlano(
  plano: Pick<
    PlanoDefinicao,
    "slug" | "limitePontos" | "maxNichos" | "precoMensal" | "incluiIa"
  >
): string[] {
  const ilimitado = plano.slug === "elite" || plano.limitePontos >= 9999;
  const todosNichos = plano.slug === "elite" || plano.maxNichos >= 6;
  const itens: string[] = [];

  if (ilimitado) {
    itens.push("Pontos ilimitados");
    itens.push("Equipamentos ilimitados");
  } else {
    itens.push(`Até ${plano.limitePontos} pontos`);
    itens.push(`Até ${plano.limitePontos} equipamentos`);
  }

  if (todosNichos) {
    itens.push("Todos os nichos que quiser");
  } else {
    itens.push(
      `Até ${plano.maxNichos} nicho${plano.maxNichos === 1 ? "" : "s"} na rota`
    );
  }

  if (planoIncluiIa(plano)) {
    itens.push("Inteligência Artificial liberada");
    if (plano.slug === "pro" || plano.slug === "elite") {
      itens.push("Análise e insights da operação");
    }
  } else if (plano.slug === "start") {
    itens.push("Painel simples e direto");
    itens.push("Coletas, pendências e fechamento");
  } else {
    itens.push("Painel completo da operação");
    itens.push("Equipe e visão por operador");
  }

  if (plano.slug === "elite") {
    itens.push("Prioridade no suporte");
  }

  return itens;
}

/** @deprecated use PLANOS_PADRAO — compat com UI antiga */
export const FAIXAS_PONTOS = PLANOS_PADRAO.map((p) => ({
  id: p.id,
  label: p.labelPontos,
  limite: p.limitePontos,
}));

/** Nichos com módulo completo — entram no plano pago */
export const NICHOS_PAGOS: Nicho[] = [
  "fura_fura",
  "maquinas_cassino",
  "ursinho",
  "diversao",
  "bolinha",
  "consignado",
];

export const MAX_NICHOS_PAGOS = 6;
export const MULTIPLICADOR_ANUAL_PADRAO = 10;

const LEGACY_FAIXA_MAP: Record<string, FaixaPontos> = {
  "11-30": "11-50",
  "11-50": "11-50",
  "31-60": "51-100",
  "61-100": "51-100",
  "51-100": "51-100",
  "1-10": "1-10",
  "100+": "100+",
  "50+": "51-100",
  "50-mais": "51-100",
};

export function normalizeFaixaPontos(value: string | null | undefined): FaixaPontos {
  if (!value) return "1-10";
  if (value in LEGACY_FAIXA_MAP) return LEGACY_FAIXA_MAP[value];
  if (PLANOS_PADRAO.some((p) => p.id === value)) return value as FaixaPontos;
  return "1-10";
}

export function getPlanoByFaixa(
  faixa: string | null | undefined,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): PlanoDefinicao {
  const id = normalizeFaixaPontos(faixa);
  return planos.find((p) => p.id === id) ?? planos[0]!;
}

export function limiteFromFaixa(
  faixa: FaixaPontos | string,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): number {
  return getPlanoByFaixa(faixa, planos).limitePontos;
}

export function maxNichosFromFaixa(
  faixa: FaixaPontos | string,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): number {
  return getPlanoByFaixa(faixa, planos).maxNichos;
}

export function slugFromFaixa(
  faixa: FaixaPontos | string,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): PlanoDefinicao["slug"] {
  return getPlanoByFaixa(faixa, planos).slug;
}

export function countNichosPagos(nichos: Nicho[]): number {
  const pagos = nichos.filter((n) => NICHOS_PAGOS.includes(n));
  return Math.max(0, pagos.length);
}

export type NichoPlanoStatus = {
  nichosPagosAtivos: number;
  maxNichosPagos: number;
  podeAdicionarNicho: boolean;
  vagasRestantes: number;
};

export function getNichoPlanoStatus(
  nichosAtivos: Nicho[],
  faixa?: string | null,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): NichoPlanoStatus {
  const maxNichosPagos = maxNichosFromFaixa(faixa ?? "1-10", planos);
  const nichosPagosAtivos = nichosAtivos.filter((n) => NICHOS_PAGOS.includes(n)).length;
  return {
    nichosPagosAtivos,
    maxNichosPagos,
    podeAdicionarNicho: nichosPagosAtivos < maxNichosPagos,
    vagasRestantes: Math.max(0, maxNichosPagos - nichosPagosAtivos),
  };
}

export function getLockedNichoCta(
  nicho: Nicho,
  plano: NichoPlanoStatus,
  faixaAtual?: string | null
) {
  if (plano.podeAdicionarNicho) {
    return {
      label: "Adicionar nicho",
      hint:
        plano.vagasRestantes === 1
          ? "1 vaga disponível no plano"
          : `${plano.vagasRestantes} vagas no plano`,
      href: `/planos?adicionar=${nicho}`,
      tone: "add" as const,
    };
  }
  const atual = getPlanoByFaixa(faixaAtual);
  const proximo = PLANOS_PADRAO.find((p) => p.maxNichos > atual.maxNichos);
  return {
    label: "Fazer upgrade",
    hint: proximo
      ? `Limite de ${plano.maxNichosPagos} nichos no ${atual.nome}. Upgrade para ${proximo.nome}.`
      : `Limite de ${plano.maxNichosPagos} nichos no plano atual.`,
    href: "/planos",
    tone: "upgrade" as const,
  };
}

export function calcPrecoMensal(
  faixa: FaixaPontos | string,
  _nichos?: Nicho[],
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): number | null {
  void _nichos;
  return getPlanoByFaixa(faixa, planos).precoMensal;
}

export function calcPrecoAnual(
  faixa: FaixaPontos | string,
  nichos?: Nicho[],
  planos: PlanoDefinicao[] = PLANOS_PADRAO,
  multiplicadorAnual = MULTIPLICADOR_ANUAL_PADRAO
): number | null {
  const m = calcPrecoMensal(faixa, nichos, planos);
  if (m == null) return null;
  return Math.round(m * multiplicadorAnual * 100) / 100;
}

export function calcPrecoCiclo(
  ciclo: "mensal" | "anual",
  faixa: FaixaPontos | string,
  nichos?: Nicho[],
  planos: PlanoDefinicao[] = PLANOS_PADRAO,
  multiplicadorAnual = MULTIPLICADOR_ANUAL_PADRAO
): number | null {
  return ciclo === "anual"
    ? calcPrecoAnual(faixa, nichos, planos, multiplicadorAnual)
    : calcPrecoMensal(faixa, nichos, planos);
}

export function formatPreco(preco: number | null): string {
  if (preco === null) return "Sob consulta";
  return (
    preco.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "/mês"
  );
}

/** Plano mínimo necessário para N nichos pagos */
export function planoMinimoParaNichos(
  qtdNichos: number,
  planos: PlanoDefinicao[] = PLANOS_PADRAO
): PlanoDefinicao {
  const ordenados = [...planos].sort((a, b) => a.maxNichos - b.maxNichos);
  return (
    ordenados.find((p) => p.maxNichos >= qtdNichos) ??
    ordenados[ordenados.length - 1]!
  );
}

/** @deprecated matriz removida — mantido vazio para imports antigos */
export type PricingMatrix = Record<string, Record<number, number | null>>;
export type NichoTier = 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_PRICING_MATRIX = {} as PricingMatrix;
export const PRICING_MATRIX = DEFAULT_PRICING_MATRIX;
