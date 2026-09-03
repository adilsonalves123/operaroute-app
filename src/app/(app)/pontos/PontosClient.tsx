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
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-pontos-sans), system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase text-at-link/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Base · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-pontos-display), Georgia, serif" }}
            >
              Pontos
            </h1>
            <p className="mt-3 text-[13px] text-at-muted">
              {pontos.length} cadastrado{pontos.length === 1 ? "" : "s"}
              {ativos > 0 ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-at-primary">{ativos}</span> ativo
                  {ativos === 1 ? "" : "s"}
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/equipamentos"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-4 py-2.5 text-[13px] text-at-muted transition hover:border-at hover:text-at-primary"
            >
              <Search className="h-3.5 w-3.5 opacity-70" />
              Máquinas
            </Link>
            <Link
              href="/pontos/novo"
              className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2.5 text-[13px] font-medium text-at-link transition hover:bg-[#c4a574]/22"
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
              <Search className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-at-muted" />
              <input
                placeholder="Nome ou cidade…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar por nome ou cidade"
                className="w-full min-w-0 rounded-sm border border-at-soft bg-at-card-soft py-2.5 !pl-11 pr-4 text-[14px] text-at-primary placeholder:truncate placeholder:text-at-muted outline-none transition focus:border-[#c4a574]/35"
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
                    ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-at-link"
                    : "border-at text-at-muted hover:border-white/12 hover:text-at-primary/85"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-4 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border border-at-soft text-at-muted">
              <MapPin className="h-6 w-6" />
            </div>
            <h3
              className="text-xl text-at-primary"
              style={{ fontFamily: "var(--font-pontos-display), Georgia, serif" }}
            >
              Nenhum ponto encontrado
            </h3>
            <p className="mt-2 max-w-sm text-[13px] text-at-muted">
              {pontos.length === 0
                ? "Cadastre o primeiro ponto para montar a base da operação."
                : "Nenhum resultado para essa busca ou filtro."}
            </p>
            {pontos.length === 0 && (
              <Link
                href="/pontos/novo"
                className="mt-6 inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-5 py-2.5 text-[13px] font-medium text-at-link transition hover:bg-[#c4a574]/22"
              >
                <Plus className="h-4 w-4" />
                Cadastrar primeiro ponto
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-at-soft">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="divide-y divide-[var(--at-border-soft)] border-t border-at">
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
