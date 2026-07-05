"use client";

import { resumoColetaFuraFura } from "@/lib/nichos/fura-fura/resumo-coleta";
import type { CalculoColetaFuraFuraResult } from "@/lib/nichos/fura-fura/calculo-coleta";
import { formatCurrency, cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function ColetaFuraFuraResumo({
  calculo,
  className,
}: {
  calculo: CalculoColetaFuraFuraResult;
  className?: string;
}) {
  const resumo = resumoColetaFuraFura(calculo);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-primary-neon/30 bg-primary-neon/5 p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-neon/90">
          A receber nesta coleta
        </p>
        <p className="text-3xl font-bold tabular-nums text-primary-neon">
          {formatCurrency(resumo.valorAReceber)}
        </p>
        <p className="text-xs text-slate-500">
          Lucro real após brindes:{" "}
          <span className="text-green-400 font-medium">{formatCurrency(resumo.lucroReal)}</span>
        </p>
      </div>

      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4 space-y-2 text-sm">
        {resumo.linhas.map((linha) => (
          <div
            key={linha.label}
            className={cn(
              "flex justify-between gap-4",
              linha.destaque && "font-medium text-white",
              linha.lucro && "border-t border-slate-700/50 pt-2 text-green-400 font-semibold"
            )}
          >
            <span className="text-slate-400">{linha.label}</span>
            <span className="tabular-nums shrink-0">
              {typeof linha.valor === "number" && linha.valor < 0
                ? `− ${formatCurrency(Math.abs(linha.valor))}`
                : formatCurrency(Math.abs(linha.valor))}
            </span>
          </div>
        ))}
      </div>

      {calculo.valorPagoRecebido > 0.009 && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm space-y-2",
            calculo.quitado
              ? "border-green-500/35 bg-green-500/8"
              : "border-amber-500/30 bg-amber-500/5"
          )}
        >
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Recebido agora</span>
            <span className="font-semibold text-green-400 tabular-nums">
              {formatCurrency(calculo.valorPagoRecebido)}
            </span>
          </div>
          {calculo.saldoPendente > 0.009 ? (
            <div className="flex justify-between gap-4 border-t border-slate-700/40 pt-2">
              <span className="text-amber-300">Falta receber</span>
              <span className="text-lg font-bold text-amber-400 tabular-nums">
                {formatCurrency(calculo.saldoPendente)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-400 border-t border-green-500/20 pt-2">
              <CheckCircle2 className="h-4 w-4" />
              Coleta quitada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
