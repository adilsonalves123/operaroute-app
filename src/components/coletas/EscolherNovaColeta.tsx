"use client";

import Link from "next/link";
import { Building2, CircleDot, Gamepad2, ToyBrick, Circle, Package } from "lucide-react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import type { Nicho } from "@/lib/types/database";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-escolher-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-escolher-sans",
});

type Props = {
  pontoId?: string;
  nichosAtivos: Nicho[];
};

const opcoesBase = [
  {
    href: "/coletas/nova/cassino",
    label: "Leitura Cassino",
    description: "Entrada e saída no painel, foto por máquina",
    icon: Building2,
    accent: "hover:border-emerald-500/40 hover:bg-emerald-500/5",
    iconClass: "text-emerald-400",
    nicho: "maquinas_cassino" as const,
  },
  {
    href: "/coletas/nova/ursinho",
    label: "Coleta Ursinho",
    description: "Entrada no visor, foto por máquina e brindes",
    icon: ToyBrick,
    accent: "hover:border-pink-500/40 hover:bg-pink-500/5",
    iconClass: "text-pink-400",
    nicho: "ursinho" as const,
  },
  {
    href: "/coletas/nova/fura-fura",
    label: "Coleta Fura Fura",
    description: "Contagem de furos, comissão e brindes",
    icon: CircleDot,
    accent: "hover:border-amber-500/40 hover:bg-amber-500/5",
    iconClass: "text-amber-400",
    nicho: "fura_fura" as const,
  },
  {
    href: "/coletas/nova/diversao",
    label: "Coleta Diversão",
    description: "Sinuca, fliperama, cadeira de massagem e outros",
    icon: Gamepad2,
    accent: "hover:border-cyan-500/40 hover:bg-cyan-500/5",
    iconClass: "text-cyan-400",
    nicho: "diversao" as const,
  },
  {
    href: "/coletas/nova/bolinha",
    label: "Coleta Bolinha / Cápsula",
    description: "Entrada no visor, foto e estoque de cápsulas",
    icon: Circle,
    accent: "hover:border-orange-500/40 hover:bg-orange-500/5",
    iconClass: "text-orange-400",
    nicho: "bolinha" as const,
  },
  {
    href: "/coletas/nova/consignado",
    label: "Recolhe Consignado",
    description: "Conte o que sobrou no expositor — baixa e comissão automáticas",
    icon: Package,
    accent: "hover:border-amber-500/40 hover:bg-amber-500/5",
    iconClass: "text-amber-400",
    nicho: "consignado" as const,
  },
];

export function EscolherNovaColeta({ pontoId, nichosAtivos }: Props) {
  const query = pontoId ? `?ponto=${pontoId}` : "";
  const opcoes = opcoesBase.filter((opcao) => {
    if (opcao.nicho === "ursinho") {
      return nichosAtivos.includes("ursinho") || nichosAtivos.includes("vending_ursinho");
    }
    return nichosAtivos.includes(opcao.nicho);
  });

  return (
    <div
      className={cn(sans.variable, display.variable, "mx-auto max-w-2xl space-y-6 pb-8")}
      style={{ fontFamily: "var(--font-escolher-sans), system-ui, sans-serif" }}
    >
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#c4a574]/80">
          Nova coleta
        </p>
        <h1
          className="mt-1.5 text-2xl tracking-tight text-[#f4efe6]"
          style={{ fontFamily: "var(--font-escolher-display), Georgia, serif" }}
        >
          Escolha o módulo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Selecione o tipo de coleta para abrir o formulário certo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {opcoes.map((opcao) => {
          const Icon = opcao.icon;
          return (
            <Link
              key={opcao.href}
              href={`${opcao.href}${query}`}
              className={cn(
                "bank-card block p-5 transition-all hover:border-[#c4a574]/20",
                opcao.accent
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5", opcao.iconClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[#f4efe6]">{opcao.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{opcao.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
