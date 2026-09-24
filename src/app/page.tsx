import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

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

export default function HomePage() {
  return <LandingPage />;
}
