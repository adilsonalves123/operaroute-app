"use client";

import Link from "next/link";
import { Building2, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  pontoId?: string;
};

const opcoes = [
  {
    href: "/coletas/nova/cassino",
    label: "Leitura Cassino",
    description: "Entrada e saída no painel, foto por máquina",
    icon: Building2,
    accent: "hover:border-emerald-500/40 hover:bg-emerald-500/5",
    iconClass: "text-emerald-400",
  },
  {
    href: "/coletas/nova/fura-fura",
    label: "Coleta Fura Fura",
    description: "Contagem de furos, comissão e brindes",
    icon: CircleDot,
    accent: "hover:border-amber-500/40 hover:bg-amber-500/5",
    iconClass: "text-amber-400",
  },
] as const;

export function EscolherNovaColeta({ pontoId }: Props) {
  const query = pontoId ? `?ponto=${pontoId}` : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nova coleta</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Escolha o módulo — Cassino e Fura Fura têm formulários diferentes.
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
                "glass-card block p-5 transition-all border border-slate-800",
                opcao.accent
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5", opcao.iconClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{opcao.label}</p>
                  <p className="mt-1 text-sm text-slate-400">{opcao.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
