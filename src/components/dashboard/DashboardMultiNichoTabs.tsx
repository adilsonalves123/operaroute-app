"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardKpiStrip, type KpiItem } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardComparativoMes } from "@/components/dashboard/DashboardComparativoMes";
import { DashboardPulso } from "@/components/dashboard/DashboardPulso";
import { DashboardCartelaPontos } from "@/components/dashboard/DashboardCartelaPontos";
import { DashboardSaudeResumo } from "@/components/dashboard/DashboardSaudeResumo";
import { DashboardRanking } from "@/components/dashboard/DashboardRanking";
import { DashboardAlertStrip } from "@/components/dashboard/DashboardAlertStrip";
import type { PulsoOperacao } from "@/lib/dashboard-pulso";
import type { CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import type { SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import type { Ponto } from "@/lib/types/database";
import type { NichoConfig } from "@/lib/nicho";

type DashSlice = {
  stats: Record<string, number>;
  ranking: { ponto: Ponto; valor: number }[];
  pontosSemColeta: number;
  sparkline: number[];
  pulso: PulsoOperacao;
  cartela: CartelaPontos;
  saude: SaudePontosResumo;
  config: NichoConfig;
  periodLabel: string;
  comparativo?: {
    mesAtual: { lucroReal: number; coletas: number };
    mesAnterior: { lucroReal: number; coletas: number };
  };
};

const HERO_KEYS = new Set(["entrada_total", "saida_total", "saldo_liquido", "total_mes", "receita_mes"]);
const WARNING_KEYS = new Set(["pendencias", "pontos_pendentes", "tarefas_abertas", "a_receber_pendente"]);

function buildKpis(config: NichoConfig, stats: Record<string, number>): KpiItem[] {
  return config.dashboard.stats
    .filter((s) => !HERO_KEYS.has(s.key))
    .slice(0, 4)
    .map((s) => ({
      label: s.label,
      value: stats[s.key] ?? 0,
      highlight: WARNING_KEYS.has(s.key) ? "warning" : "default",
      isCurrency: ["lucro_estimado", "a_receber_pendente"].includes(s.key),
    }));
}

function resolveHeroSaldo(stats: Record<string, number>): number {
  if (stats.lucro_estimado != null && stats.entrada_total === undefined) {
    return stats.lucro_estimado;
  }
  if (stats.entrada_total !== undefined && stats.saida_total !== undefined) {
    return stats.saldo_liquido ?? stats.entrada_total - stats.saida_total;
  }
  return stats.saldo_liquido ?? stats.total_mes ?? stats.receita_mes ?? 0;
}

function NichoPanel({ data }: { data: DashSlice }) {
  const hasEntradaSaida =
    (data.stats.entrada_total ?? 0) > 0 || (data.stats.saida_total ?? 0) > 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        saldo={resolveHeroSaldo(data.stats)}
        entrada={hasEntradaSaida ? data.stats.entrada_total : undefined}
        saida={hasEntradaSaida ? data.stats.saida_total : undefined}
        periodLabel={data.periodLabel}
        nichoLabel={data.config.label}
        sparkline={data.sparkline}
      />

      {data.comparativo && (
        <DashboardComparativoMes
          lucroAtual={data.comparativo.mesAtual.lucroReal}
          lucroAnterior={data.comparativo.mesAnterior.lucroReal}
          coletasAtual={data.comparativo.mesAtual.coletas}
          coletasAnterior={data.comparativo.mesAnterior.coletas}
        />
      )}

      <DashboardKpiStrip items={buildKpis(data.config, data.stats)} />
      <DashboardSaudeResumo saude={data.saude} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPulso pulso={data.pulso} />
        <DashboardCartelaPontos cartela={data.cartela} />
      </div>
      <DashboardAlertStrip pontosSemColeta={data.pontosSemColeta} />
      {data.ranking.length > 0 && <DashboardRanking ranking={data.ranking} />}
    </div>
  );
}

type Tab = "cassino" | "fura_fura";

export function DashboardMultiNichoTabs({
  cassino,
  furaFura,
}: {
  cassino: DashSlice;
  furaFura: DashSlice;
}) {
  const [tab, setTab] = useState<Tab>("cassino");

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-slate-800">
        {(
          [
            { id: "cassino" as const, label: "Cassino" },
            { id: "fura_fura" as const, label: "Fura Fura" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "pb-2.5 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.id
                ? "border-primary-neon text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "cassino" ? <NichoPanel data={cassino} /> : <NichoPanel data={furaFura} />}
    </div>
  );
}
