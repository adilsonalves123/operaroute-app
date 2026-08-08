"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DashboardConsolidado,
  type DashboardConsolidadoTab,
} from "@/components/dashboard/DashboardConsolidado";
import { DashboardKpiStrip, type KpiItem } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardComparativoMes } from "@/components/dashboard/DashboardComparativoMes";
import { DashboardPulso } from "@/components/dashboard/DashboardPulso";
import { DashboardCartelaPontos } from "@/components/dashboard/DashboardCartelaPontos";
import { DashboardSaudeResumo } from "@/components/dashboard/DashboardSaudeResumo";
import { DashboardRanking, type DashboardRankingPoint } from "@/components/dashboard/DashboardRanking";
import { DashboardAlertStrip } from "@/components/dashboard/DashboardAlertStrip";
import type { DashboardConsolidadoData } from "@/lib/dashboard-consolidado";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";
import type { PulsoOperacao } from "@/lib/dashboard-pulso";
import type { CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import type { SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import type { NichoConfig } from "@/lib/nicho";

export type DashSlice = {
  stats: Record<string, number>;
  ranking: { ponto: DashboardRankingPoint; valor: number }[];
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

const TAB_LABELS: Record<DashboardNichoId, string> = {
  maquinas_cassino: "Cassino",
  fura_fura: "Fura Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

const HERO_KEYS = new Set(["entrada_total", "saida_total", "saldo_liquido", "total_mes", "receita_mes"]);
const WARNING_KEYS = new Set(["pendencias", "pontos_pendentes", "tarefas_abertas", "a_receber_pendente"]);

function buildKpis(config: NichoConfig, stats: Record<string, number>): KpiItem[] {
  return config.dashboard.stats
    .filter((s) => !HERO_KEYS.has(s.key))
    .slice(0, 6)
    .map((s) => ({
      label: s.label,
      value: stats[s.key] ?? 0,
      highlight: WARNING_KEYS.has(s.key) ? "warning" : "default",
      isCurrency: [
        "lucro_estimado",
        "a_receber_pendente",
        "haver_ponto",
        "custo_brindes",
        "saldo_liquido",
      ].includes(s.key),
    }));
}

function NichoDetalhe({
  data,
  chamadosAbertos = 0,
}: {
  data: DashSlice;
  chamadosAbertos?: number;
}) {
  return (
    <div className="space-y-6">
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
      <DashboardAlertStrip
        pontosSemColeta={data.pontosSemColeta}
        chamadosAbertos={chamadosAbertos}
      />
      {data.ranking.length > 0 && (
        <DashboardRanking ranking={data.ranking} title={`Top pontos · ${data.config.label}`} />
      )}
    </div>
  );
}

export function DashboardMultiNichoView({
  consolidado,
  slices,
  nichos,
  periodLabel,
  chamadosAbertos = 0,
}: {
  consolidado: DashboardConsolidadoData;
  slices: Partial<Record<DashboardNichoId, DashSlice>>;
  nichos: DashboardNichoId[];
  periodLabel: string;
  chamadosAbertos?: number;
}) {
  const [tab, setTab] = useState<DashboardNichoId>(nichos[0]);
  const active = slices[tab];

  return (
    <div className="space-y-8">
      {chamadosAbertos > 0 && (
        <DashboardAlertStrip pontosSemColeta={0} chamadosAbertos={chamadosAbertos} />
      )}
      <DashboardConsolidado
        data={consolidado}
        periodLabel={periodLabel}
        activeTab={tab}
        onTabChange={setTab}
        nichos={nichos}
      />

      {active && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-medium text-white">{active.config.label}</h2>
            <span className="text-xs text-slate-600">·</span>
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 p-0.5">
              {nichos.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition",
                    tab === id
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {TAB_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
          <NichoDetalhe data={active} chamadosAbertos={chamadosAbertos} />
        </div>
      )}
    </div>
  );
}

export function DashboardMultiNichoTabs({
  slices,
  nichos,
}: {
  slices: Partial<Record<DashboardNichoId, DashSlice>>;
  nichos: DashboardNichoId[];
}) {
  const [tab, setTab] = useState<DashboardNichoId>(nichos[0]);
  const active = slices[tab];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 border-b border-slate-800">
        {nichos.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition",
              tab === id
                ? "border-primary-neon text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>
      {active && <NichoDetalhe data={active} />}
    </div>
  );
}

export type { DashboardConsolidadoTab };
