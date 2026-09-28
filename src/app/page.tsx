import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { loadProvaSocial } from "@/lib/marketing/prova-social-server";
import { PROVA_SOCIAL_VAZIA, type ProvaSocial } from "@/lib/marketing/prova-social";
import {
  MULTIPLICADOR_ANUAL_PADRAO,
  PESO_PRECO_NICHOS,
  PLANOS_PADRAO,
  type PesosNichos,
  type PlanoDefinicao,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "OperaRoute — Leitura que fecha o dia",
  description:
    "App de operação para cassino, fura-fura e nichos: leitura de painel, coleta, negativo e financeiro. 7 dias grátis.",
  openGraph: {
    title: "OperaRoute — Leitura que fecha o dia",
    description:
      "Dashboard, coleta cassino, pontos e pendências — o comando da operação no celular.",
  },
};

/** Salvar no painel do dono revalida na hora; isso é só a rede de segurança. */
export const revalidate = 600;

type DadosLanding = {
  planos: PlanoDefinicao[];
  multiplicadorAnual: number;
  pesos: PesosNichos;
  prova: ProvaSocial;
};

async function carregarDadosLanding(): Promise<DadosLanding> {
  const padrao: DadosLanding = {
    planos: PLANOS_PADRAO,
    multiplicadorAnual: MULTIPLICADOR_ANUAL_PADRAO,
    pesos: PESO_PRECO_NICHOS,
    prova: PROVA_SOCIAL_VAZIA,
  };
  if (!isAdminConfigured()) return padrao;
  try {
    const admin = createAdminClient();
    const [precos, prova] = await Promise.all([
      loadPrecosPayload(admin),
      loadProvaSocial(admin),
    ]);
    return {
      planos: precos.planos,
      multiplicadorAnual: precos.multiplicador_anual,
      pesos: precos.pesos_nichos,
      prova,
    };
  } catch {
    return padrao;
  }
}

export default async function HomePage() {
  const dados = await carregarDadosLanding();
  return <LandingPage {...dados} />;
}
