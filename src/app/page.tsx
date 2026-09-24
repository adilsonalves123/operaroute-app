import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "OperaRoute — Controle total da sua operação",
  description:
    "Organize pontos, coletas e rotas no celular. Menos retrabalho, mais arrecadação. 7 dias grátis.",
  openGraph: {
    title: "OperaRoute — Sua rota rende mais",
    description:
      "Gestão operacional para quem vive de ponto: coletas, rotas e financeiro no mesmo sinal.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
