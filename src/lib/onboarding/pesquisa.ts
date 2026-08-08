import {
  countNichosPagos,
  getPlanoByFaixa,
  maxNichosFromFaixa,
  NICHOS_PAGOS,
  normalizeFaixaPontos,
  PLANOS_PADRAO,
  type FaixaPontos,
} from "@/lib/pricing";
import { NICHOS } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";

export type PesquisaOnboardingStored = {
  quantidade_pontos: FaixaPontos | string;
  nichos_interesse: Nicho[];
  possui_funcionarios: boolean;
  respondido_em: string;
};

export function buildPesquisaOnboarding(input: {
  quantidade_pontos: string;
  nichos: Nicho[];
  possui_funcionarios: boolean;
}): PesquisaOnboardingStored {
  return {
    quantidade_pontos: normalizeFaixaPontos(input.quantidade_pontos),
    nichos_interesse: [...new Set(input.nichos)],
    possui_funcionarios: Boolean(input.possui_funcionarios),
    respondido_em: new Date().toISOString(),
  };
}

export function parsePesquisaOnboarding(
  raw: unknown
): PesquisaOnboardingStored | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const nichos = Array.isArray(o.nichos_interesse)
    ? (o.nichos_interesse.filter((n) => typeof n === "string") as Nicho[])
    : [];
  if (nichos.length === 0) return null;
  return {
    quantidade_pontos: normalizeFaixaPontos(
      typeof o.quantidade_pontos === "string" ? o.quantidade_pontos : "1-10"
    ),
    nichos_interesse: [...new Set(nichos)],
    possui_funcionarios: Boolean(o.possui_funcionarios),
    respondido_em:
      typeof o.respondido_em === "string"
        ? o.respondido_em
        : new Date().toISOString(),
  };
}

/**
 * Quais nichos ativar no plano atual vs. quais ficam só como interesse (upgrade).
 */
export function splitNichosPorPlano(
  nichosInteresse: Nicho[],
  faixaPontos: string
): { ativar: Nicho[]; bloqueados: Nicho[]; maxNichos: number } {
  const maxNichos = maxNichosFromFaixa(faixaPontos);
  const unicos = [...new Set(nichosInteresse)];
  const pagos = unicos.filter((n) => NICHOS_PAGOS.includes(n));
  const livres = unicos.filter((n) => !NICHOS_PAGOS.includes(n));
  const ativarPagos = pagos.slice(0, maxNichos);
  const bloqueados = pagos.slice(maxNichos);
  const ativar = [...ativarPagos, ...livres];
  if (ativar.length === 0 && unicos[0]) ativar.push(unicos[0]);
  return { ativar: [...new Set(ativar)], bloqueados, maxNichos };
}

export type PesquisaUpgradeInsight = {
  temInteresseExtra: boolean;
  nichosInteresse: Nicho[];
  nichosBloqueados: Nicho[];
  nichosAtivosPagos: number;
  maxNichosPlano: number;
  planoNome: string;
  proximoPlanoNome: string | null;
  labelsBloqueados: string[];
  mensagem: string;
  href: string;
};

/** Compara interesse da pesquisa com nichos já ativos no plano. */
export function insightUpgradePesquisa(
  pesquisa: PesquisaOnboardingStored | null,
  nichosAtivos: Nicho[],
  faixaAtual?: string | null
): PesquisaUpgradeInsight | null {
  if (!pesquisa) return null;

  const faixa = normalizeFaixaPontos(
    faixaAtual || pesquisa.quantidade_pontos || "1-10"
  );
  const plano = getPlanoByFaixa(faixa);
  const maxNichos = plano.maxNichos;
  const interessePagos = pesquisa.nichos_interesse.filter((n) =>
    NICHOS_PAGOS.includes(n)
  );
  const ativosPagos = nichosAtivos.filter((n) => NICHOS_PAGOS.includes(n));
  const bloqueados = interessePagos.filter((n) => !ativosPagos.includes(n));
  const interesseAcimaDoPlano = countNichosPagos(interessePagos) > maxNichos;

  if (bloqueados.length === 0 && !interesseAcimaDoPlano) return null;

  const proximoPlano = PLANOS_PADRAO.find((p) => p.maxNichos > maxNichos);
  const labelsSource =
    bloqueados.length > 0 ? bloqueados : interessePagos.slice(maxNichos);
  const labelsBloqueados = labelsSource.map((n) => NICHOS[n]?.label ?? n);
  const lista = labelsBloqueados.slice(0, 3).join(", ");
  const extra =
    labelsBloqueados.length > 3 ? ` e mais ${labelsBloqueados.length - 3}` : "";

  return {
    temInteresseExtra: true,
    nichosInteresse: pesquisa.nichos_interesse,
    nichosBloqueados: labelsSource,
    nichosAtivosPagos: ativosPagos.length,
    maxNichosPlano: maxNichos,
    planoNome: plano.nome,
    proximoPlanoNome: proximoPlano?.nome ?? null,
    labelsBloqueados,
    mensagem: proximoPlano
      ? `Na pesquisa você marcou ${interessePagos.length} nichos (${lista}${extra}). O plano ${plano.nome} libera ${maxNichos}. Faça upgrade para ${proximoPlano.nome} e ative o restante.`
      : `Na pesquisa você marcou mais nichos do que o plano atual libera. Em breve promoções para liberar ${lista}${extra}.`,
    href: "/planos",
  };
}
