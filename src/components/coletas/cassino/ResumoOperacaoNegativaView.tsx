"use client";

import { displayOperacaoNegativa } from "@/lib/nichos/cassino/resumo-visita";
import type { AdiantamentoDetalhe } from "@/lib/nichos/cassino/relatorio";
import { hintAdiantamento } from "@/lib/nichos/cassino/relatorio";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { formatCurrency, cn } from "@/lib/utils";

const corLinha = {
  operador: "text-amber-400",
  ponto: "text-cyan-300",
  "haver-usado": "text-cyan-400",
  "pendencia-operacao": "text-rose-300",
} as const;

function LinhaDetalhe({
  label,
  hint,
  valorReais,
  tipo,
  extraHint,
}: {
  label: string;
  hint?: string;
  valorReais: number;
  tipo: keyof typeof corLinha;
  extraHint?: string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between gap-4">
        <span className="text-slate-300">{label}</span>
        <span className={cn("font-semibold tabular-nums shrink-0", corLinha[tipo])}>
          {formatCurrency(valorReais)}
        </span>
      </div>
      {(hint || extraHint) && (
        <p className="text-[11px] text-slate-500 mt-0.5 text-right">
          {[hint, extraHint].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function ResumoOperacaoNegativaView({
  calculo,
  adiantamento,
  className,
}: {
  calculo: CalculoVisitaResult;
  adiantamento?: AdiantamentoDetalhe;
  className?: string;
}) {
  const d = displayOperacaoNegativa(calculo);
  const adiantHint =
    adiantamento && calculo.valorDeixadoOperadorReais > 0.009
      ? hintAdiantamento(adiantamento)
      : undefined;

  const somaFechamento = d.fechamento.reduce((s, l) => s + l.valorReais, 0);

  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {calculo.pendenciaOperacaoTotalReais > 0.009 && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-400/90">
            Pendência de coleta anterior
          </p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Cliente devia (em aberto)</span>
            <span className="font-semibold text-rose-300 tabular-nums">
              {formatCurrency(calculo.pendenciaOperacaoTotalReais)}
            </span>
          </div>
          {calculo.pendenciaOperacaoAbatidaReais > 0.009 && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Abatido nesta visita</span>
              <span className="font-semibold text-green-400 tabular-nums">
                {formatCurrency(calculo.pendenciaOperacaoAbatidaReais)}
              </span>
            </div>
          )}
          {calculo.pendenciaOperacaoRestanteReais > 0.009 && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Ainda em aberto</span>
              <span className="font-semibold text-amber-300 tabular-nums">
                {formatCurrency(calculo.pendenciaOperacaoRestanteReais)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-400/90">
            Prejuízo no visor desta visita
          </p>
          <p className="text-3xl font-bold tabular-nums text-red-300 mt-1">
            {formatCurrency(d.prejuizoVisitaReais)}
          </p>
        </div>

        <div className="border-t border-red-500/15 pt-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
            Quem cobriu o prejuízo
          </p>
          {d.fechamento.map((item) => (
            <LinhaDetalhe
              key={item.id}
              label={item.label}
              hint={item.hint}
              valorReais={item.valorReais}
              tipo={item.tipo}
              extraHint={
                item.id === "reposto" ? adiantHint : undefined
              }
            />
          ))}
          {d.fechamento.length > 1 && (
            <div className="flex justify-between gap-4 border-t border-red-500/15 pt-2 mt-2">
              <span className="font-medium text-slate-300">Total coberto</span>
              <span className="font-semibold tabular-nums text-white">
                {formatCurrency(somaFechamento)}
              </span>
            </div>
          )}
        </div>
      </div>

      {d.mostrarNegativoAcumulado && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
            A recuperar nas próximas coletas positivas
          </p>
          {d.negativoAnteriorReais > 0.009 && (
            <div className="flex justify-between gap-4 text-slate-400">
              <span>Negativo acumulado anterior</span>
              <span className="tabular-nums">{formatCurrency(d.negativoAnteriorReais)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 text-slate-400">
            <span>+ Prejuízo desta visita</span>
            <span className="tabular-nums text-amber-300/90">
              {formatCurrency(d.negativoAdiantadoHojeReais)}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t border-amber-500/25 pt-3">
            <span className="font-semibold text-white">Total a recuperar</span>
            <span className="text-xl font-bold tabular-nums text-amber-300">
              {formatCurrency(d.negativoTotalProximaReais)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Valor integral do prejuízo — recupera quando o ponto tiver lucro positivo.
          </p>
        </div>
      )}

      {d.mostrarSaldoLiquido && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-green-400/90">
            {d.rotuloSaldoLiquido}
          </p>
          {d.linhasReceberDoPonto.length > 0 ? (
            <div className="space-y-1">
              {d.linhasReceberDoPonto.map((item) => (
                <LinhaDetalhe
                  key={item.id}
                  label={item.label}
                  hint={item.hint}
                  valorReais={item.valorReais}
                  tipo={item.tipo}
                />
              ))}
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-green-500/25 pt-3">
            <span className="font-semibold text-white">Total</span>
            <span className="text-xl font-bold tabular-nums text-green-400">
              {formatCurrency(d.valorSaldoLiquidoAbs)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
