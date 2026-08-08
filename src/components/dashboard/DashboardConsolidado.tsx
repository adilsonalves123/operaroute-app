"use client";

import Link from "next/link";
import { Dices, Gamepad2, Gift, ToyBrick, Circle, Package } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { DashboardSparkline } from "./DashboardSparkline";
import type { DashboardConsolidadoData, NichoConsolidadoLinha } from "@/lib/dashboard-consolidado";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";

export type DashboardConsolidadoTab = DashboardNichoId;

const CARD_META: Record<
  DashboardNichoId,
  { label: string; icon: typeof Dices; accent: "violet" | "cyan" | "pink" | "orange" | "amber" }
> = {
  maquinas_cassino: { label: "Cassino", icon: Dices, accent: "violet" },
  fura_fura: { label: "Fura Fura", icon: Gift, accent: "cyan" },
  ursinho: { label: "Ursinho", icon: ToyBrick, accent: "pink" },
  diversao: { label: "Diversão", icon: Gamepad2, accent: "cyan" },
  bolinha: { label: "Bolinha", icon: Circle, accent: "orange" },
  consignado: { label: "Consignado", icon: Package, accent: "amber" },
};

function OperacaoCard({
  id,
  label,
  icon: Icon,
  linha,
  active,
  onSelect,
  accent,
}: {
  id: DashboardNichoId;
  label: string;
  icon: typeof Dices;
  linha: NichoConsolidadoLinha;
  active: boolean;
  onSelect: (tab: DashboardNichoId) => void;
  accent: "violet" | "cyan" | "pink" | "orange" | "amber";
}) {
  const border =
    accent === "violet"
      ? active
        ? "border-violet-500/50 ring-1 ring-violet-500/30"
        : "border-slate-800 hover:border-violet-500/25"
      : accent === "pink"
        ? active
          ? "border-pink-500/50 ring-1 ring-pink-500/30"
          : "border-slate-800 hover:border-pink-500/25"
        : accent === "orange"
          ? active
            ? "border-orange-500/50 ring-1 ring-orange-500/30"
            : "border-slate-800 hover:border-orange-500/25"
          : accent === "amber"
            ? active
              ? "border-amber-500/50 ring-1 ring-amber-500/30"
              : "border-slate-800 hover:border-amber-500/25"
            : active
              ? "border-primary-neon/50 ring-1 ring-primary-neon/30"
              : "border-slate-800 hover:border-primary-neon/25";

  const iconWrap =
    accent === "violet"
      ? "bg-violet-500/15 text-violet-400"
      : accent === "pink"
        ? "bg-pink-500/15 text-pink-400"
        : accent === "orange"
          ? "bg-orange-500/15 text-orange-400"
          : accent === "amber"
            ? "bg-amber-500/15 text-amber-300"
            : "bg-primary-neon/15 text-primary-neon";

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "glass-card w-full p-4 text-left transition-all",
        border,
        active && "bg-slate-900/60"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconWrap)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white">
        {formatCurrency(linha.liquidoOperacao)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">lucro líquido (recebido)</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-slate-500">
          Entrada{" "}
          <span className="text-emerald-400/90 tabular-nums">{formatCurrency(linha.entrada)}</span>
        </span>
        <span className="text-slate-500">
          Saída{" "}
          <span className="text-rose-400/90 tabular-nums">{formatCurrency(linha.saida)}</span>
        </span>
        <span className="text-slate-500">
          Movimento{" "}
          <span className="text-slate-300 tabular-nums">
            {formatCurrency(linha.liquidoMovimento)}
          </span>
        </span>
        {linha.aReceber > 0.009 && (
          <span className="text-slate-500">
            Pendente{" "}
            <span className="text-amber-400 tabular-nums">{formatCurrency(linha.aReceber)}</span>
          </span>
        )}
        {linha.haver > 0.009 && (
          <span className="text-slate-500">
            Haver <span className="text-cyan-400 tabular-nums">+{formatCurrency(linha.haver)}</span>
          </span>
        )}
        <span className="text-slate-600">
          {linha.movimentos} {linha.movimentos === 1 ? "mov." : "mov."}
        </span>
      </div>
    </button>
  );
}

export function DashboardConsolidado({
  data,
  periodLabel,
  activeTab,
  onTabChange,
  nichos,
}: {
  data: DashboardConsolidadoData;
  periodLabel: string;
  activeTab: DashboardNichoId;
  onTabChange: (tab: DashboardNichoId) => void;
  nichos: DashboardNichoId[];
}) {
  const { total, sparkline } = data;

  return (
    <section className="space-y-4">
      <div className="bank-card relative overflow-hidden px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary-neon/5 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500">
              {periodLabel} · <span className="text-slate-400">operação completa</span>
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-neon sm:text-4xl">
              {formatCurrency(total.liquidoOperacao)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              lucro líquido · entrada {formatCurrency(total.entrada)} · saída{" "}
              {formatCurrency(total.saida)}
            </p>
          </div>
          <div className="flex items-end gap-6">
            {(total.aReceber > 0.009 || total.haver > 0.009) && (
              <div className="space-y-1 text-sm">
                {total.aReceber > 0.009 && (
                  <p>
                    <span className="text-slate-500">A receber </span>
                    <span className="font-medium text-amber-400 tabular-nums">
                      {formatCurrency(total.aReceber)}
                    </span>
                  </p>
                )}
                {total.haver > 0.009 && (
                  <p>
                    <span className="text-slate-500">Haver </span>
                    <span className="font-medium text-cyan-400 tabular-nums">
                      +{formatCurrency(total.haver)}
                    </span>
                  </p>
                )}
                <Link href="/pendencias" className="text-xs text-primary-neon hover:underline">
                  Pendências →
                </Link>
              </div>
            )}
            {sparkline.length > 1 && (
              <div className="hidden w-28 sm:block">
                <DashboardSparkline values={sparkline} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3",
          nichos.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {nichos.map((id) => {
          const meta = CARD_META[id];
          const linha = data.linhas[id];
          if (!meta || !linha) return null;
          return (
            <OperacaoCard
              key={id}
              id={id}
              label={meta.label}
              icon={meta.icon}
              linha={linha}
              active={activeTab === id}
              onSelect={onTabChange}
              accent={meta.accent}
            />
          );
        })}
      </div>
    </section>
  );
}
