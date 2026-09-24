import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "OperaRoute — Controle de cassino, fura-fura e nichos",
  description:
    "Leitura de máquinas, coletas, negativos e financeiro no celular. Cassino, fura-fura, ursinho e mais. 7 dias grátis.",
  openGraph: {
    title: "OperaRoute — Cada leitura no painel. Cada centavo no lugar.",
    description:
      "App de operação para quem vive de máquina em ponto: leituras, coletas e fechamento sem planilha.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
