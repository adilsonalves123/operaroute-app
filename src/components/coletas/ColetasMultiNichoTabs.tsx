"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Outfit, Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";
import { VisitasListClient } from "@/components/coletas/cassino/VisitasListClient";
import {
  FuraFuraColetasClient,
  type ColetaFuraListItem,
} from "@/components/coletas/fura-fura/FuraFuraColetasClient";
import { ColetasClient } from "@/app/(app)/coletas/ColetasClient";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";
import type { Coleta } from "@/lib/types/database";

type Visita = Parameters<typeof VisitasListClient>[0]["visitas"][number];
type ColetaUrsinho = Coleta & { pontos?: { nome: string; cidade: string | null } | null };

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const TAB_LABELS: Record<DashboardNichoId, string> = {
  maquinas_cassino: "Cassino",
  fura_fura: "Fura Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

const NOVA_COLETA: Record<DashboardNichoId, { href: string; label: string }> = {
  maquinas_cassino: { href: "/coletas/nova/cassino", label: "Nova leitura" },
  fura_fura: { href: "/coletas/nova/fura-fura", label: "Nova coleta" },
  ursinho: { href: "/coletas/nova/ursinho", label: "Nova coleta" },
  diversao: { href: "/coletas/nova/diversao", label: "Nova coleta" },
  bolinha: { href: "/coletas/nova/bolinha", label: "Nova coleta" },
  consignado: { href: "/coletas/nova/consignado", label: "Novo recolhe" },
};

export function ColetasMultiNichoTabs({
  nichos,
  visitas = [],
  coletasFura = [],
  coletasUrsinho = [],
  coletasDiversao = [],
  coletasBolinha = [],
  coletasConsignado = [],
}: {
  nichos: DashboardNichoId[];
  visitas?: Visita[];
  coletasFura?: ColetaFuraListItem[];
  coletasUrsinho?: ColetaUrsinho[];
  coletasDiversao?: ColetaUrsinho[];
  coletasBolinha?: ColetaUrsinho[];
  coletasConsignado?: ColetaUrsinho[];
}) {
  const [tab, setTab] = useState<DashboardNichoId>(nichos[0]);
  const nova = NOVA_COLETA[tab];

  return (
    <div className={cn(outfit.className, "relative space-y-8")}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-16 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(196,165,116,0.1),_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-24 h-52 w-52 rounded-full bg-[#c4a574]/[0.05] blur-3xl"
      />

      <header className="relative space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-at-link/80">
              Operação diária
            </p>
            <h1
              className={cn(
                display.className,
                "mt-2 text-[2.65rem] leading-none tracking-tight text-at-primary sm:text-5xl"
              )}
            >
              Coletas
            </h1>
          </div>

          <Link
            href={nova.href}
            className="group inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-[#c4a574] px-5 py-3 text-sm font-semibold text-[#0a0e16] transition duration-200 hover:bg-[#d4b584] hover:shadow-[0_12px_40px_-16px_rgba(196,165,116,0.65)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 transition duration-300 group-hover:rotate-90" />
            {nova.label}
          </Link>
        </div>

        <nav
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-at bg-slate-950/50 p-1.5 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Nichos"
        >
          {nichos.map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[#c4a574] text-[#0a0e16] shadow-sm"
                    : "text-at-muted hover:bg-at-card-soft hover:text-at-primary"
                )}
              >
                {TAB_LABELS[id]}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="relative">
        {tab === "maquinas_cassino" && <VisitasListClient visitas={visitas} />}
        {tab === "fura_fura" && <FuraFuraColetasClient coletas={coletasFura} />}
        {tab === "ursinho" && (
          <ColetasClient coletas={coletasUrsinho} novaColetaHref="/coletas/nova/ursinho" />
        )}
        {tab === "diversao" && (
          <ColetasClient coletas={coletasDiversao} novaColetaHref="/coletas/nova/diversao" />
        )}
        {tab === "bolinha" && (
          <ColetasClient coletas={coletasBolinha} novaColetaHref="/coletas/nova/bolinha" />
        )}
        {tab === "consignado" && (
          <ColetasClient coletas={coletasConsignado} novaColetaHref="/coletas/nova/consignado" />
        )}
      </div>
    </div>
  );
}
