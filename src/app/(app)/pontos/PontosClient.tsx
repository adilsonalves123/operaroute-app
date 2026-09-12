"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import { MapPin, Plus, Search } from "lucide-react";
import { PointCard } from "@/components/cards/PointCard";
import { cn } from "@/lib/utils";
import type { Ponto } from "@/lib/types/database";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pontos-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-pontos-sans",
});

interface PontosClientProps {
  pontos: Ponto[];
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "pausado", label: "Pausados" },
  { value: "retirado", label: "Retirados" },
  { value: "inadimplente", label: "Inadimplentes" },
];

export function PontosClient({ pontos }: PontosClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    return pontos.filter((p) => {
      const matchSearch =
        !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.cidade?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pontos, search, statusFilter]);

  const ativos = pontos.filter((p) => p.status === "ativo").length;

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6"
      )}
      style={{ fontFamily: "var(--font-pontos-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 45% at 50% -8%, rgba(196,165,116,0.12), transparent 55%), radial-gradient(ellipse 40% 30% at 100% 40%, rgba(120,90,50,0.08), transparent 50%), linear-gradient(180deg, #06080e 0%, #0a0e16 55%, #07090f 100%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase text-[#c4a574]/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Base · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-pontos-display), Georgia, serif" }}
            >
              Pontos
            </h1>
            <p className="mt-3 text-[13px] text-slate-400">
              {pontos.length} cadastrado{pontos.length === 1 ? "" : "s"}
              {ativos > 0 ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-[#f4efe6]">{ativos}</span> ativo
                  {ativos === 1 ? "" : "s"}
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/equipamentos"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-white/20 hover:text-[#f4efe6]"
            >
              <Search className="h-3.5 w-3.5 opacity-70" />
              Máquinas
            </Link>
            <Link
              href="/pontos/novo"
              className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2.5 text-[13px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/22"
            >
              <Plus className="h-4 w-4" />
              Novo ponto
            </Link>
          </div>
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-[#c4a574]/50 via-white/10 to-transparent" />

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 w-full flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                placeholder="Nome ou cidade…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar por nome ou cidade"
                className="w-full min-w-0 rounded-sm border border-white/[0.08] bg-white/[0.03] py-2.5 !pl-11 pr-4 text-[14px] text-[#f4efe6] placeholder:truncate placeholder:text-slate-500 outline-none transition focus:border-[#c4a574]/35"
              />
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "shrink-0 rounded-sm border px-3.5 py-1.5 text-[12px] transition",
                  statusFilter === tab.value
                    ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#c4a574]"
                    : "border-white/[0.06] text-slate-500 hover:border-white/12 hover:text-slate-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-4 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border border-white/[0.08] text-slate-500">
              <MapPin className="h-6 w-6" />
            </div>
            <h3
              className="text-xl text-[#f4efe6]"
              style={{ fontFamily: "var(--font-pontos-display), Georgia, serif" }}
            >
              Nenhum ponto encontrado
            </h3>
            <p className="mt-2 max-w-sm text-[13px] text-slate-500">
              {pontos.length === 0
                ? "Cadastre o primeiro ponto para montar a base da operação."
                : "Nenhum resultado para essa busca ou filtro."}
            </p>
            {pontos.length === 0 && (
              <Link
                href="/pontos/novo"
                className="mt-6 inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-5 py-2.5 text-[13px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/22"
              >
                <Plus className="h-4 w-4" />
                Cadastrar primeiro ponto
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-600">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="divide-y divide-white/[0.04] border-t border-white/[0.06]">
              {filtered.map((ponto) => (
                <PointCard key={ponto.id} ponto={ponto} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
