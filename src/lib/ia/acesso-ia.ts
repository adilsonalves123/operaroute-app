import { cache } from "react";
import { NextResponse } from "next/server";
import {
  buildAcessoAssinaturaInput,
  estaEmTrial,
  temPagamentoValido,
  type AcessoAssinaturaInput,
} from "@/lib/assinatura-acesso";
import { resolverOwnerProfileAcesso } from "@/lib/assinatura-owner";
import { loadPrecosPayload } from "@/lib/dono/precos";
import {
  getPlanoByFaixa,
  PLANOS_PADRAO,
  planoIncluiIa,
  type PlanoDefinicao,
} from "@/lib/pricing";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";

export type AcessoIa = {
  liberada: boolean;
  /** plano = Pro/Elite pago · trial = teste grátis · bloqueada = plano sem IA */
  motivo: "plano" | "trial" | "bloqueada";
  planoAtual: string;
  /** Nomes dos planos que incluem IA (ex.: "Pro e Elite"). */
  planosComIa: string;
};

const carregarPlanos = cache(async (): Promise<PlanoDefinicao[]> => {
  if (!isAdminConfigured()) return PLANOS_PADRAO;
  try {
    return (await loadPrecosPayload(createAdminClient())).planos;
  } catch {
    return PLANOS_PADRAO;
  }
});

function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "Pro";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function calcularAcessoIa(
  quantidadePontos: string | null | undefined,
  acessoAssinatura: AcessoAssinaturaInput,
  planos: PlanoDefinicao[]
): AcessoIa {
  const plano = getPlanoByFaixa(quantidadePontos, planos);
  const planosComIa = juntarNomes(planos.filter(planoIncluiIa).map((p) => p.nome));
  const base = { planoAtual: plano.nome, planosComIa };

  if (temPagamentoValido(acessoAssinatura)) {
    return planoIncluiIa(plano)
      ? { ...base, liberada: true, motivo: "plano" }
      : { ...base, liberada: false, motivo: "bloqueada" };
  }
  // Teste grátis libera a IA para o cliente conhecer antes de escolher o plano.
  if (estaEmTrial(acessoAssinatura)) {
    return { ...base, liberada: true, motivo: "trial" };
  }
  return { ...base, liberada: false, motivo: "bloqueada" };
}

export async function resolverAcessoIa(
  quantidadePontos: string | null | undefined,
  acessoAssinatura: AcessoAssinaturaInput
): Promise<AcessoIa> {
  return calcularAcessoIa(quantidadePontos, acessoAssinatura, await carregarPlanos());
}

export function mensagemIaBloqueada(acesso: Pick<AcessoIa, "planoAtual" | "planosComIa">) {
  return `Leitura por foto com IA faz parte dos planos ${acesso.planosComIa}. No ${acesso.planoAtual} você digita os números normalmente — ou faça upgrade em Planos.`;
}

/** Guard das rotas de leitura por foto. Retorna resposta 403 se o plano não inclui IA. */
export async function exigirIaLiberada(): Promise<NextResponse | null> {
  const { profile, empresa } = await getAppBootstrap();
  const ownerProfile = await resolverOwnerProfileAcesso(profile, empresa?.owner_id);
  const acesso = await resolverAcessoIa(
    empresa?.quantidade_pontos,
    buildAcessoAssinaturaInput(ownerProfile, empresa)
  );
  if (acesso.liberada) return null;
  return NextResponse.json(
    {
      error: mensagemIaBloqueada(acesso),
      code: "ia_plano",
      upgrade_url: "/planos",
    },
    { status: 403 }
  );
}
