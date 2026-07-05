"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashboardPulso } from "@/components/dashboard/DashboardPulso";
import { DashboardCartelaPontos } from "@/components/dashboard/DashboardCartelaPontos";
import { DashboardRanking } from "@/components/dashboard/DashboardRanking";
import { DashboardComparativoMes } from "@/components/dashboard/DashboardComparativoMes";
import { SaudePontosPainel } from "@/components/analise/SaudePontosPainel";
import type { PulsoOperacao } from "@/lib/dashboard-pulso";
import type { CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import type { SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import type { Ponto } from "@/lib/types/database";

type AnaliseSlice = {
  ranking: { ponto: Ponto; valor: number }[];
  pulso: PulsoOperacao;
  cartela: CartelaPontos;
  saude: SaudePontosResumo;
  comparativo?: {
    mesAtual: { lucroReal: number; coletas: number };
    mesAnterior: { lucroReal: number; coletas: number };
  };
};

function AnalisePanel({ data }: { data: AnaliseSlice }) {
  return (
    <div className="space-y-8">
      {data.comparativo && (
        <DashboardComparativoMes
          lucroAtual={data.comparativo.mesAtual.lucroReal}
          lucroAnterior={data.comparativo.mesAnterior.lucroReal}
          coletasAtual={data.comparativo.mesAtual.coletas}
          coletasAnterior={data.comparativo.mesAnterior.coletas}
        />
      )}
      <SaudePontosPainel itens={data.saude.mes} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPulso pulso={data.pulso} />
        <DashboardCartelaPontos cartela={data.cartela} />
      </div>
      {data.ranking.length > 0 && (
        <DashboardRanking ranking={data.ranking} title="Ranking financeiro do mês" />
      )}
    </div>
  );
}

type Tab = "cassino" | "fura_fura";

export function AnaliseMultiNichoTabs({
  cassino,
  furaFura,
}: {
  cassino: AnaliseSlice;
  furaFura: AnaliseSlice;
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
      {tab === "cassino" ? <AnalisePanel data={cassino} /> : <AnalisePanel data={furaFura} />}
    </div>
  );
}
