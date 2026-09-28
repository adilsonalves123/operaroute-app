import { getLimitePontos } from "@/lib/assinatura";

/** A partir disso o plano é tratado como ilimitado (Elite). */
export const LIMITE_ILIMITADO = 9999;

/**
 * Equipamentos ativos permitidos no plano — o catálogo vende "Até N pontos"
 * e "Até N equipamentos" com o mesmo N.
 */
export function getLimiteEquipamentos(
  quantidadePontos: string | null | undefined,
  limitePontos?: number | null
): number {
  return getLimitePontos(quantidadePontos, limitePontos);
}

export function limiteEhIlimitado(limite: number): boolean {
  return limite >= LIMITE_ILIMITADO;
}

/** Quem já passou do limite mantém o que tem; só não adiciona mais. */
export function podeAdicionarEquipamentos(
  ativos: number,
  adicionar: number,
  limite: number
): boolean {
  if (adicionar <= 0 || limiteEhIlimitado(limite)) return true;
  return ativos + adicionar <= limite;
}

export function mensagemLimiteEquipamentos(
  ativos: number,
  adicionar: number,
  limite: number
): string {
  const vagas = Math.max(0, limite - ativos);
  const base = `Limite de equipamentos do seu plano atingido (${ativos} de ${limite} em uso).`;
  if (adicionar > 1 && vagas > 0) {
    return `${base} Cabem mais ${vagas}, mas você tentou cadastrar ${adicionar}. Faça upgrade em Planos para continuar.`;
  }
  return `${base} Faça upgrade em Planos para cadastrar mais.`;
}
