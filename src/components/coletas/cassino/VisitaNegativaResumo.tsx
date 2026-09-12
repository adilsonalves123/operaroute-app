"use client";

import { ResumoOperacaoNegativaView } from "@/components/coletas/cassino/ResumoOperacaoNegativaView";
import type { AdiantamentoDetalhe } from "@/lib/nichos/cassino/relatorio";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { centesimosToReais, formatContador } from "@/lib/nichos/cassino";
import { cn, formatCurrency } from "@/lib/utils";

export function VisitaNegativaResumo({
  calculo,
  adiantamento,
  totalLucroCentavos,
  className,
}: {
  calculo: CalculoVisitaResult;
  adiantamento?: AdiantamentoDetalhe;
  totalLucroCentavos: number;
  className?: string;
}) {
  const bruto = centesimosToReais(totalLucroCentavos);

  return (
    <div className={cn("glass-card space-y-3 p-5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="text-slate-500">Lucro da visita</p>
        <p className="font-semibold tabular-nums text-red-300">
          {formatContador(totalLucroCentavos)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Entrada</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-400">
            {formatCurrency(centesimosToReais(calculo.totalEntradaPeriodo))}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Saída</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-rose-400">
            {formatCurrency(centesimosToReais(calculo.totalSaidaPeriodo))}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Bruto</p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              bruto < -0.009 ? "text-red-300" : "text-white"
            )}
          >
            {formatCurrency(bruto)}
          </p>
        </div>
      </div>
      <ResumoOperacaoNegativaView calculo={calculo} adiantamento={adiantamento} />
    </div>
  );
}
