"use client";

import { useState } from "react";
import {
  ChevronDown,
  CheckCircle2,
  HandCoins,
  ArrowDownLeft,
  Wallet,
  BadgePercent,
} from "lucide-react";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";
import { centesimosToReais } from "@/lib/nichos/cassino";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import { formatCurrency, cn } from "@/lib/utils";

type Passo = {
  id: string;
  label: string;
  valor: number;
  tom: "neutro" | "positivo" | "destaque" | "cyan" | "amber";
  operador?: "−" | "+" | "=";
};

function tomClass(tom: Passo["tom"]) {
  switch (tom) {
    case "positivo":
      return "text-emerald-400";
    case "destaque":
      return "text-cyan-300";
    case "cyan":
      return "text-cyan-400";
    case "amber":
      return "text-amber-400";
    default:
      return "text-white";
  }
}

function formatPassoValor(passo: Passo) {
  const abs = formatCurrency(Math.abs(passo.valor));
  if (passo.operador === "−") return `− ${abs}`;
  if (passo.operador === "+") return `+ ${abs}`;
  return abs;
}

/** Só o caminho do dinheiro — sem repetir o card de haver. */
function buildPassos(calculo: CalculoVisitaResult, comissaoPercentual: number): Passo[] {
  const lucro = centesimosToReais(calculo.totalLucroCentavos);
  const operacao =
    calculo.valorOperacaoEfetivoReais > 0.009
      ? calculo.valorOperacaoEfetivoReais
      : calculo.valorOperacaoReais;

  const passos: Passo[] = [
    {
      id: "lucro",
      label: "Lucro bruto",
      valor: lucro,
      tom: "positivo",
    },
  ];

  if (calculo.descontoManualReais > 0.009) {
    passos.push({
      id: "desc-lucro",
      label: "Desconto no lucro",
      valor: calculo.descontoManualReais,
      tom: "amber",
      operador: "−",
    });
  }

  if (calculo.recuperacaoNegativoReais > 0.009) {
    passos.push({
      id: "neg-rec",
      label: "Negativo recuperado",
      valor: calculo.recuperacaoNegativoReais,
      tom: "amber",
      operador: "−",
    });
  }

  if (calculo.valorClienteReais > 0.009 || calculo.comissaoAplicada) {
    passos.push({
      id: "comissao",
      label:
        comissaoPercentual > 0
          ? `Comissão (${comissaoPercentual}%)`
          : "Comissão do cliente",
      valor: calculo.valorClienteReais,
      tom: "amber",
      operador: "−",
    });
  }

  passos.push({
    id: "operacao",
    label: "Sua operação",
    valor: operacao,
    tom: "positivo",
    operador: "=",
  });

  if (calculo.descontoRecebimentoReais > 0.009) {
    passos.push({
      id: "desc-acerto",
      label: "Desconto no acerto",
      valor: calculo.descontoRecebimentoReais,
      tom: "amber",
      operador: "−",
    });
  }

  if (calculo.pendenciaOperacaoIncluidaReais > 0.009) {
    passos.push({
      id: "pend-op",
      label: "Pendência anterior",
      valor: calculo.pendenciaOperacaoIncluidaReais,
      tom: "amber",
      operador: "+",
    });
  }

  if (calculo.haverCompensadoReais > 0.009) {
    passos.push({
      id: "haver",
      label: "Haver abatido",
      valor: calculo.haverCompensadoReais,
      tom: "cyan",
      operador: "−",
    });
  }

  passos.push({
    id: "resultado",
    label:
      calculo.totalACobrarReais > 0.009
        ? "A receber do cliente"
        : "A receber do cliente",
    valor: calculo.totalACobrarReais,
    tom: calculo.totalACobrarReais > 0.009 ? "destaque" : "neutro",
    operador: "=",
  });

  return passos;
}

export function VisitaPositivaResumo({
  calculo,
  comissaoPercentual,
  totalLucroCentavos,
  className,
  ocultarStaff = false,
}: {
  calculo: CalculoVisitaResult;
  comissaoPercentual: number;
  totalLucroCentavos: number;
  className?: string;
  /** Esconde comissão de staff no link público. */
  ocultarStaff?: boolean;
}) {
  const [detalheAberto, setDetalheAberto] = useState(false);
  const passos = buildPassos({ ...calculo, totalLucroCentavos }, comissaoPercentual);

  const operacao =
    calculo.valorOperacaoEfetivoReais > 0.009
      ? calculo.valorOperacaoEfetivoReais
      : calculo.valorOperacaoReais;

  const temHaver =
    calculo.haverTotalReais > 0.009 ||
    calculo.haverCompensadoReais > 0.009 ||
    calculo.haverQuitadoReais > 0.009;

  const haverAntes =
    calculo.haverTotalReais > 0.009
      ? calculo.haverTotalReais
      : calculo.haverCompensadoReais + calculo.haverQuitadoReais + calculo.haverRestanteReais;

  const cobertoPorHaver =
    calculo.haverCompensadoReais > 0.009 && calculo.totalACobrarReais <= 0.009;

  const temPagamento =
    calculo.valorPagoReais > 0.009 || calculo.restanteReais > 0.009;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 1. Resultado — só o desfecho */}
      <section
        className={cn(
          "rounded-2xl border p-5",
          cobertoPorHaver
            ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/12 to-slate-950"
            : calculo.totalACobrarReais > 0.009
              ? "border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 to-slate-950"
              : "border-slate-700/80 bg-slate-900/50"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20">
            {cobertoPorHaver ? (
              <HandCoins className="h-5 w-5 text-cyan-400" />
            ) : calculo.totalACobrarReais > 0.009 ? (
              <ArrowDownLeft className="h-5 w-5 text-cyan-300" />
            ) : (
              <Wallet className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Resultado
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-white sm:text-lg">
              {cobertoPorHaver
                ? "Nada a receber"
                : calculo.totalACobrarReais > 0.009
                  ? "Receber do cliente"
                  : "Sem cobrança"}
            </h2>
            <p
              className={cn(
                "mt-1 text-3xl font-bold tabular-nums tracking-tight",
                cobertoPorHaver || calculo.totalACobrarReais > 0.009
                  ? "text-cyan-300"
                  : "text-slate-200"
              )}
            >
              {formatCurrency(calculo.totalACobrarReais)}
            </p>
            {cobertoPorHaver && (
              <p className="mt-1.5 text-sm text-slate-400">
                Operação de {formatCurrency(operacao)} coberta pelo haver
              </p>
            )}
            {!cobertoPorHaver && calculo.valorPagoReais > 0.009 && (
              <p className="mt-1.5 text-sm text-slate-400">
                Recebido {formatCurrency(calculo.valorPagoReais)}
                {calculo.restanteReais > 0.009
                  ? ` · falta ${formatCurrency(calculo.restanteReais)}`
                  : " · quitado"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 2. Números da visita — uma vez */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">
            Lucro
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-xl">
            {formatCurrency(centesimosToReais(totalLucroCentavos))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">
            <BadgePercent className="hidden h-3 w-3 sm:block" />
            Comissão
            {comissaoPercentual > 0 ? ` ${comissaoPercentual}%` : ""}
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-amber-400 sm:text-xl">
            {formatCurrency(calculo.valorClienteReais)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">
            Operação
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-emerald-400 sm:text-xl">
            {formatCurrency(operacao)}
          </p>
        </div>
      </section>

      {!ocultarStaff && (
        <ComissaoStaffLinha lucroAposBrindes={calculo.valorOperacaoReais} />
      )}

      {/* 3. Haver — único bloco, se existir */}
      {temHaver && (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/8 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-cyan-400" />
            <p className="text-sm font-semibold text-cyan-100">Haver do ponto</p>
            {calculo.haverDeNegativoTotalReais > 0.009 && (
              <p className="text-[11px] text-violet-300/90 mt-0.5">
                Inclui {formatCurrency(calculo.haverDeNegativoTotalReais)} de cliente que pagou
                ganhadores (comissão bloqueada nesse valor)
              </p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cyan-400/70 sm:text-[11px]">
                Tinha
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-200 sm:text-xl">
                {formatCurrency(haverAntes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cyan-400/70 sm:text-[11px]">
                Usou
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-200 sm:text-xl">
                −{formatCurrency(calculo.haverCompensadoReais)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cyan-400/70 sm:text-[11px]">
                {calculo.haverQuitadoReais > 0.009 ? "Pagou" : "Sobrou"}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-200 sm:text-xl">
                {calculo.haverQuitadoReais > 0.009
                  ? formatCurrency(calculo.haverQuitadoReais)
                  : formatCurrency(calculo.haverRestanteReais)}
              </p>
            </div>
          </div>
          {calculo.haverQuitadoReais > 0.009 && calculo.haverRestanteReais > 0.009 && (
            <p className="mt-2 text-xs text-slate-400">
              Ainda em aberto: {formatCurrency(calculo.haverRestanteReais)}
            </p>
          )}
        </section>
      )}

      {/* 4. Conta detalhada — fechada por padrão */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <button
          type="button"
          onClick={() => setDetalheAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
          aria-expanded={detalheAberto}
        >
          <p className="text-sm font-medium text-slate-300">Ver conta passo a passo</p>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
              detalheAberto && "rotate-180"
            )}
          />
        </button>

        {detalheAberto && (
          <div className="border-t border-slate-800/80 px-4 pb-4 pt-1">
            <ol className="space-y-0.5">
              {passos.map((passo, idx) => {
                const destaque = passo.id === "resultado" || passo.id === "operacao";
                return (
                  <li key={passo.id}>
                    {destaque && idx > 0 && (
                      <div className="my-1.5 border-t border-dashed border-slate-700/70" />
                    )}
                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg px-2 py-2",
                        destaque && "bg-white/[0.03]"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm",
                          destaque ? "font-medium text-white" : "text-slate-400"
                        )}
                      >
                        {passo.label}
                      </p>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          tomClass(passo.tom)
                        )}
                      >
                        {formatPassoValor(passo)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {/* 5. Pagamento — só se houver movimento de caixa do cliente */}
      {temPagamento && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3.5">
          <div className="space-y-2 text-sm">
            {calculo.valorPagoReais > 0.009 && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Recebido</span>
                <span className="font-semibold tabular-nums text-emerald-400">
                  {formatCurrency(calculo.valorPagoReais)}
                </span>
              </div>
            )}
            {calculo.restanteReais > 0.009 ? (
              <div className="flex justify-between gap-4 border-t border-slate-800 pt-2">
                <span className="font-medium text-amber-300">Em aberto</span>
                <span className="font-bold tabular-nums text-amber-400">
                  {formatCurrency(calculo.restanteReais)}
                </span>
              </div>
            ) : calculo.valorPagoReais > 0.009 ? (
              <div className="flex items-center gap-2 border-t border-slate-800 pt-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Quitada</span>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
