"use client";

import { CobrancaClienteResumo } from "@/components/coletas/cassino/CobrancaClienteResumo";
import { formatContador } from "@/lib/nichos/cassino";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { formatCurrency, cn } from "@/lib/utils";

export function VisitaPositivaResumo({
  calculo,
  comissaoPercentual,
  totalLucroCentavos,
  className,
}: {
  calculo: CalculoVisitaResult;
  comissaoPercentual: number;
  totalLucroCentavos: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="glass-card p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div>
          <p className="text-slate-500">Lucro da visita</p>
          <p className="font-semibold text-white">{formatContador(totalLucroCentavos)}</p>
        </div>
        {calculo.descontoManualReais > 0.009 && (
          <div>
            <p className="text-slate-500">Desconto no lucro</p>
            <p className="font-semibold text-orange-400">
              − {formatCurrency(calculo.descontoManualReais)}
            </p>
            <p className="text-[10px] text-slate-500">Antes da comissão</p>
          </div>
        )}
        {calculo.descontoRecebimentoReais > 0.009 && (
          <div>
            <p className="text-slate-500">Desconto no acerto</p>
            <p className="font-semibold text-orange-400">
              − {formatCurrency(calculo.descontoRecebimentoReais)}
            </p>
            <p className="text-[10px] text-slate-500">No valor a pagar</p>
          </div>
        )}
        {calculo.recuperacaoNegativoReais > 0.009 && (
          <div>
            <p className="text-slate-500">Coberto pelo lucro (negativo)</p>
            <p className="font-semibold text-cyan-400">
              {formatCurrency(calculo.recuperacaoNegativoReais)}
            </p>
            <p className="text-[10px] text-slate-500">Abate antes da comissão</p>
          </div>
        )}
        <div>
          <p className="text-slate-500">
            Comissão cliente
            {calculo.comissaoAplicada && comissaoPercentual > 0 && (
              <span className="text-slate-600"> ({comissaoPercentual}%)</span>
            )}
          </p>
          <p className="font-semibold text-amber-400">
            {formatCurrency(calculo.valorClienteReais)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Valor operação</p>
          <p className="font-semibold text-green-400">
            {formatCurrency(calculo.valorOperacaoReais)}
          </p>
        </div>
      </div>

      <CobrancaClienteResumo calculo={calculo} />
    </div>
  );
}
