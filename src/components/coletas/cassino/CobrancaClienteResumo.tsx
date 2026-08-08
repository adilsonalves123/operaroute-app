"use client";

import { resumoCobrancaCliente } from "@/lib/nichos/cassino/resumo-visita";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { formatCurrency, cn } from "@/lib/utils";
import { CheckCircle2, HandCoins } from "lucide-react";

export function CobrancaClienteResumo({
  calculo,
  className,
}: {
  calculo: CalculoVisitaResult;
  className?: string;
}) {
  const cobranca = resumoCobrancaCliente(calculo);
  const temPagamento = cobranca.valorRecebidoReais > 0.009;
  const mostrarTotal = cobranca.totalACobrarReais > 0.009;
  const operacaoCobranca =
    calculo.valorOperacaoEfetivoReais > 0.009
      ? calculo.valorOperacaoEfetivoReais
      : calculo.valorOperacaoReais;
  /** Haver abateu a cobrança inteira — operador não recebe nesta visita. */
  const operacaoCobertaPorHaver =
    !calculo.saldoNegativo &&
    calculo.haverCompensadoReais > 0.009 &&
    cobranca.totalACobrarReais <= 0.009 &&
    operacaoCobranca > 0.009;

  if (!mostrarTotal && !temPagamento && !operacaoCobertaPorHaver) return null;

  const hintFalta = (): string | undefined => {
    const partes: string[] = [];
    if (cobranca.faltaNegativoReais > 0.009) {
      partes.push(`negativo ${formatCurrency(cobranca.faltaNegativoReais)}`);
    }
    if (cobranca.faltaOperacaoReais > 0.009) {
      partes.push(`operação ${formatCurrency(cobranca.faltaOperacaoReais)}`);
    }
    return partes.length > 0 ? partes.join(" · ") : undefined;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {operacaoCobertaPorHaver && (
        <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/8 px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">
                Nada a receber nesta coleta
              </p>
              <p className="text-sm leading-relaxed text-slate-200">
                A operação ({formatCurrency(operacaoCobranca)}) foi coberta pelo haver do ponto —
                o cliente não pagou nesta visita.
              </p>
            </div>
          </div>

          {cobranca.itens.length > 0 && (
            <div className="border-t border-cyan-500/20 pt-3 space-y-1.5 text-sm">
              {cobranca.itens.map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-medium tabular-nums text-slate-200">
                    {formatCurrency(item.valorReais)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {calculo.haverQuitadoReais > 0.009 && (
            <div className="rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm flex justify-between gap-4">
              <span className="text-cyan-200/90">Você pagou o restante do haver</span>
              <span className="font-semibold tabular-nums text-cyan-300 shrink-0">
                {formatCurrency(calculo.haverQuitadoReais)}
              </span>
            </div>
          )}

          {calculo.haverRestanteReais > 0.009 && (
            <div className="rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm flex justify-between gap-4">
              <span className="text-cyan-200/90">Haver que você ainda deve ao ponto</span>
              <span className="font-semibold tabular-nums text-cyan-300 shrink-0">
                {formatCurrency(calculo.haverRestanteReais)}
              </span>
            </div>
          )}
        </div>
      )}

      {mostrarTotal && (
        <div className="rounded-lg border border-primary-neon/35 bg-primary-neon/8 px-4 py-4 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-neon/90">
              Receber do cliente
            </p>
            <p className="text-3xl font-bold tabular-nums text-primary-neon mt-1">
              {formatCurrency(cobranca.totalACobrarReais)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {cobranca.negativoParaProximaReais > 0.009
                ? "Valor desta visita — o restante do negativo fica para a próxima coleta"
                : calculo.haverCompensadoReais > 0.009
                  ? "Já descontando haver do ponto"
                  : "Valor total desta coleta — informe abaixo quanto recebeu (Pix + dinheiro)"}
            </p>
          </div>

          {cobranca.itens.length > 0 && (
            <div className="border-t border-primary-neon/20 pt-3 space-y-1.5 text-sm">
              {cobranca.itens.map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-medium tabular-nums text-slate-200">
                    {formatCurrency(item.valorReais)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {cobranca.negativoParaProximaReais > 0.009 && (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm flex justify-between gap-4">
              <span className="text-amber-200/90">Negativo que fica para a próxima coleta</span>
              <span className="font-semibold tabular-nums text-amber-300 shrink-0">
                {formatCurrency(cobranca.negativoParaProximaReais)}
              </span>
            </div>
          )}
        </div>
      )}

      {temPagamento && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 space-y-2 text-sm",
            cobranca.quitado
              ? "border-green-500/35 bg-green-500/8"
              : "border-amber-500/30 bg-amber-500/5"
          )}
        >
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Recebido agora</span>
            <span className="font-semibold tabular-nums text-green-400">
              {formatCurrency(cobranca.valorRecebidoReais)}
            </span>
          </div>

          {cobranca.faltaReceberReais > 0.009 ? (
            <div className="flex justify-between gap-4 border-t border-slate-700/50 pt-2">
              <span className="font-medium text-amber-300">Falta receber</span>
              <span className="text-lg font-bold tabular-nums text-amber-400">
                {formatCurrency(cobranca.faltaReceberReais)}
              </span>
            </div>
          ) : cobranca.quitado ? (
            <div className="space-y-1 border-t border-green-500/20 pt-2">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-medium">Cobrança desta visita quitada</span>
              </div>
              {cobranca.negativoParaProximaReais > 0.009 && (
                <p className="text-[11px] text-amber-400/90 text-right">
                  {formatCurrency(cobranca.negativoParaProximaReais)} de negativo anterior ficam para
                  a próxima coleta
                </p>
              )}
            </div>
          ) : null}

          {hintFalta() && cobranca.faltaReceberReais > 0.009 && (
            <p className="text-[11px] text-slate-500 text-right">
              {cobranca.faltaOperacaoReais > 0.009
                ? `dívida da operação ${formatCurrency(cobranca.faltaOperacaoReais)}`
                : hintFalta()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
