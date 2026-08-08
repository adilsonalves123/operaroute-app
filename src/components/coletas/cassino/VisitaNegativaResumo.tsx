"use client";

import { ResumoOperacaoNegativaView } from "@/components/coletas/cassino/ResumoOperacaoNegativaView";
import type { AdiantamentoDetalhe } from "@/lib/nichos/cassino/relatorio";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { formatContador } from "@/lib/nichos/cassino";
import { cn } from "@/lib/utils";

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
  return (
    <div className={cn("glass-card space-y-3 p-5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="text-slate-500">Lucro da visita</p>
        <p className="font-semibold tabular-nums text-red-300">
          {formatContador(totalLucroCentavos)}
        </p>
      </div>
      <ResumoOperacaoNegativaView calculo={calculo} adiantamento={adiantamento} />
    </div>
  );
}
