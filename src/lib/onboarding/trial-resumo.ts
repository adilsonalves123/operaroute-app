import {
  getPlanoByFaixa,
  normalizeFaixaPontos,
  NICHOS_PAGOS,
} from "@/lib/pricing";
import { TRIAL_DIAS_PADRAO } from "@/lib/assinatura-acesso";
import type { Nicho } from "@/lib/types/database";

export type TrialResumo = {
  dias: number;
  planoNome: string;
  faixa: string;
  limitePontos: number;
  maxNichos: number;
  labelPontos: string;
  labelNichos: string;
  /** Nichos de interesse acima do limite do plano/trial */
  nichosAlemDoTrial: number;
};

export function resumoTrialPorFaixa(
  faixaRaw: string | null | undefined,
  nichosInteresse: Nicho[] = []
): TrialResumo {
  const faixa = normalizeFaixaPontos(faixaRaw);
  const plano = getPlanoByFaixa(faixa);
  const pagos = nichosInteresse.filter((n) => NICHOS_PAGOS.includes(n)).length;
  const limitePontos = plano.limitePontos;
  const maxNichos = plano.maxNichos;

  return {
    dias: TRIAL_DIAS_PADRAO,
    planoNome: plano.nome,
    faixa,
    limitePontos,
    maxNichos,
    labelPontos:
      limitePontos >= 9999 ? "pontos sem teto prático" : `até ${limitePontos} pontos`,
    labelNichos: `até ${maxNichos} nicho${maxNichos === 1 ? "" : "s"}`,
    nichosAlemDoTrial: Math.max(0, pagos - maxNichos),
  };
}
