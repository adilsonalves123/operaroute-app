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

function quaseIgual(a: number, b: number) {
  return Math.abs(a - b) <= 0.009;
}

function LinhaCompacta({
  label,
  valorReais,
  tipo,
  hint,
}: {
  label: string;
  valorReais: number;
  tipo: keyof typeof corLinha;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <span className="text-slate-400">{label}</span>
        {hint ? <span className="ml-1.5 text-[11px] text-slate-600">{hint}</span> : null}
      </div>
      <span className={cn("shrink-0 font-semibold tabular-nums", corLinha[tipo])}>
        {formatCurrency(valorReais)}
      </span>
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

  const temNegativoAnterior = d.negativoAnteriorReais > 0.009;
  const fechamentoSimples =
    d.fechamento.length === 1 && quaseIgual(d.fechamento[0].valorReais, d.prejuizoVisitaReais);

  const mostrarSaldoSeparado =
    d.mostrarSaldoLiquido &&
    (calculo.saldoLiquidoReais > 0 ||
      !quaseIgual(d.valorSaldoLiquidoAbs, d.negativoTotalProximaReais) ||
      d.linhasReceberDoPonto.length > 1);

  const fraseFechamento = fechamentoSimples
    ? [
        d.fechamento[0].label,
        adiantHint || d.fechamento[0].hint || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className={cn("space-y-3", className)}>
      {calculo.pendenciaOperacaoTotalReais > 0.009 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3.5 py-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-rose-200/90">Pendência anterior</span>
            <span className="font-semibold tabular-nums text-rose-300">
              {formatCurrency(calculo.pendenciaOperacaoTotalReais)}
            </span>
          </div>
          {calculo.pendenciaOperacaoAbatidaReais > 0.009 && (
            <p className="mt-1 text-xs text-slate-500">
              Abatido agora −{formatCurrency(calculo.pendenciaOperacaoAbatidaReais)}
              {calculo.pendenciaOperacaoRestanteReais > 0.009 && (
                <> · ainda {formatCurrency(calculo.pendenciaOperacaoRestanteReais)}</>
              )}
            </p>
          )}
        </div>
      )}

      {/* Hero do negativo — um bloco, uma leitura */}
      <div className="overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-500/[0.14] to-red-950/20">
        <div className="px-4 pb-3 pt-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300/90">
            Negativo da visita
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-red-200">
            {formatCurrency(d.prejuizoVisitaReais)}
          </p>
          <p className="mt-2 text-sm leading-snug text-slate-400">
            Comissão bloqueada — recupera na próxima positiva.
          </p>
          {fraseFechamento && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{fraseFechamento}</p>
          )}
        </div>

        {!fechamentoSimples && d.fechamento.length > 0 && (
          <div className="border-t border-red-500/15 px-4 py-2.5 sm:px-5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Quem cobriu
            </p>
            <div className="space-y-0.5 text-sm">
              {d.fechamento.map((item) => (
                <LinhaCompacta
                  key={item.id}
                  label={item.label}
                  valorReais={item.valorReais}
                  tipo={item.tipo}
                  hint={item.id === "reposto" ? adiantHint : item.hint}
                />
              ))}
            </div>
          </div>
        )}

        {d.mostrarNegativoAcumulado && (
          <div className="border-t border-red-500/20 bg-black/25 px-4 py-3 sm:px-5">
            {temNegativoAnterior ? (
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex justify-between gap-3">
                  <span>Negativo anterior</span>
                  <span className="tabular-nums">{formatCurrency(d.negativoAnteriorReais)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>+ Desta visita</span>
                  <span className="tabular-nums text-amber-300/80">
                    {formatCurrency(d.negativoAdiantadoHojeReais)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 pt-1 text-sm">
                  <span className="font-medium text-amber-200">A recuperar</span>
                  <span className="font-bold tabular-nums text-amber-300">
                    {formatCurrency(d.negativoTotalProximaReais)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-amber-100/90">A recuperar nas próximas</span>
                <span className="text-lg font-bold tabular-nums text-amber-300">
                  {formatCurrency(d.negativoTotalProximaReais)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {mostrarSaldoSeparado && (
        <div
          className={cn(
            "rounded-xl border px-3.5 py-2.5",
            calculo.saldoLiquidoReais > 0
              ? "border-green-500/25 bg-green-500/[0.06]"
              : "border-amber-500/25 bg-amber-500/[0.06]"
          )}
        >
          <div className="flex justify-between gap-3 text-sm">
            <span
              className={cn(
                "font-medium",
                calculo.saldoLiquidoReais > 0 ? "text-green-300" : "text-amber-300"
              )}
            >
              {d.rotuloSaldoLiquido}
            </span>
            <span
              className={cn(
                "font-bold tabular-nums",
                calculo.saldoLiquidoReais > 0 ? "text-green-400" : "text-amber-400"
              )}
            >
              {formatCurrency(d.valorSaldoLiquidoAbs)}
            </span>
          </div>
          {d.linhasReceberDoPonto.length > 1 && (
            <div className="mt-2 space-y-0.5 border-t border-white/5 pt-2 text-sm">
              {d.linhasReceberDoPonto.map((item) => (
                <LinhaCompacta
                  key={item.id}
                  label={item.label}
                  valorReais={item.valorReais}
                  tipo={item.tipo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
