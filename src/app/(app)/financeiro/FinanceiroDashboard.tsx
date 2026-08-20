"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { descricaoValeVisivel } from "@/lib/equipe/vale-staff";
import type { Financeiro } from "@/lib/types/database";
import {
  breakdownLancamento,
  formaPagamentoLabel,
  type VisitaFinanceiro,
} from "@/lib/financeiro/breakdown";
import {
  dataNoPeriodo,
  periodoLabels,
  type PeriodoFiltro,
} from "@/lib/financeiro/periodo";
import type { ComposicaoCaixa } from "@/lib/financeiro/saldo-caixa";
import { ArrowDownLeft, ArrowUpRight, Info, Wallet } from "lucide-react";

type FinanceiroRow = Financeiro & {
  visita_id?: string | null;
  visitas?: VisitaFinanceiro;
};

const periodos: PeriodoFiltro[] = ["hoje", "7d", "30d", "tudo"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function FinanceiroDashboard({
  lancamentos,
  composicao,
}: {
  lancamentos: FinanceiroRow[];
  composicao: ComposicaoCaixa;
}) {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("hoje");

  const saldoExibido = Math.max(0, composicao.saldo);
  const pixCaixa = Math.max(0, round2(composicao.pix));
  const dinheiroCaixa = Math.max(0, round2(composicao.dinheiro));
  const naoClassificado = round2(composicao.naoClassificado);
  const naoClassificadoAbs = Math.abs(naoClassificado);

  const movimento = useMemo(() => {
    const rows = lancamentos.filter((l) => dataNoPeriodo(l.data, periodo));
    const entradas = rows
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = rows
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);

    let entradasPix = 0;
    let entradasDinheiro = 0;
    for (const l of rows) {
      if (l.tipo !== "entrada") continue;
      const b = breakdownLancamento(l);
      entradasPix += b.pix;
      entradasDinheiro += b.dinheiro;
      const classificado = b.pix + b.dinheiro;
      if (classificado <= 0.009) {
        const forma = String(l.forma_pagamento ?? "").toLowerCase();
        if (forma === "pix") entradasPix += Number(l.valor);
        else if (forma === "dinheiro") entradasDinheiro += Number(l.valor);
      }
    }

    return {
      rows,
      entradas: round2(entradas),
      saidas: round2(saidas),
      resultado: round2(entradas - saidas),
      entradasPix: round2(entradasPix),
      entradasDinheiro: round2(entradasDinheiro),
    };
  }, [lancamentos, periodo]);

  const movimentoHoje = useMemo(() => {
    const rows = lancamentos.filter((l) => dataNoPeriodo(l.data, "hoje"));
    const entradas = rows
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = rows
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);
    return {
      entradas: round2(entradas),
      saidas: round2(saidas),
    };
  }, [lancamentos]);

  return (
    <div className="space-y-8">
      {/* 1. Caixa agora — o que você tem */}
      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            No caixa agora
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            Saldo real da operação — não muda com o filtro de dias
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-slate-950/80 p-5 sm:p-6">
          <p className="text-sm text-slate-400">Saldo disponível</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {formatCurrency(saldoExibido)}
          </p>
          {composicao.saldo < -0.009 && (
            <p className="mt-1 text-xs text-amber-300/90">
              Histórico com saldo negativo — exibido como zero para novas saídas
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs text-cyan-200/80">Pix</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-200">
                {formatCurrency(pixCaixa)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-xs text-amber-200/80">Dinheiro</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-amber-100">
                {formatCurrency(dinheiroCaixa)}
              </p>
            </div>
          </div>

          {naoClassificadoAbs > 0.05 && (
            <p className="mt-3 flex gap-2 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {formatCurrency(naoClassificadoAbs)} em lançamentos sem Pix/dinheiro
                definidos (antigos ou misto sem detalhe). Por isso Pix + Dinheiro pode
                diferir do saldo.
              </span>
            </p>
          )}
        </div>
      </section>

      {/* 2. Hoje — sempre visível */}
      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Hoje
          </p>
          <p className="mt-0.5 text-sm text-slate-500">O que entrou e saiu neste dia</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4">
            <div className="flex items-center gap-2 text-emerald-300/90">
              <ArrowDownLeft className="h-4 w-4" />
              <p className="text-xs font-medium">Entrou</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300">
              {formatCurrency(movimentoHoje.entradas)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-4">
            <div className="flex items-center gap-2 text-rose-300/90">
              <ArrowUpRight className="h-4 w-4" />
              <p className="text-xs font-medium">Saiu</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-rose-300">
              {formatCurrency(movimentoHoje.saidas)}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Movimento por período + lista */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Movimento
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              Filtra só entradas, saídas e a lista — não o saldo do caixa
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodos.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  periodo === p
                    ? "border border-primary-neon/40 bg-primary-neon/20 text-primary-neon"
                    : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {periodoLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 sm:px-4">
            <p className="text-[11px] text-slate-500">Entradas</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-emerald-400 sm:text-lg">
              {formatCurrency(movimento.entradas)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 sm:px-4">
            <p className="text-[11px] text-slate-500">Saídas</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-rose-400 sm:text-lg">
              {formatCurrency(movimento.saidas)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 sm:px-4">
            <p className="text-[11px] text-slate-500">Resultado</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-lg">
              {formatCurrency(movimento.resultado)}
            </p>
          </div>
        </div>

        {(movimento.entradasPix > 0.009 || movimento.entradasDinheiro > 0.009) && (
          <p className="text-xs text-slate-500">
            Entradas no período:{" "}
            {movimento.entradasPix > 0.009 && (
              <span className="text-cyan-400">Pix {formatCurrency(movimento.entradasPix)}</span>
            )}
            {movimento.entradasPix > 0.009 && movimento.entradasDinheiro > 0.009 && (
              <span className="text-slate-600"> · </span>
            )}
            {movimento.entradasDinheiro > 0.009 && (
              <span className="text-amber-400">
                Dinheiro {formatCurrency(movimento.entradasDinheiro)}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={`/financeiro/negativos?periodo=${periodo}`}
            className="text-primary-neon hover:underline"
          >
            Ver negativos recuperados →
          </Link>
        </div>

        {movimento.rows.length === 0 ? (
          <EmptyState
            title="Nada neste período"
            description={`Nenhum lançamento em ${periodoLabels[periodo].toLowerCase()}.`}
            icon={<Wallet className="h-8 w-8" />}
          />
        ) : (
          <div className="space-y-2">
            {movimento.rows.map((l) => {
              const b = breakdownLancamento(l);
              const temPixDinheiro = b.pix > 0.009 || b.dinheiro > 0.009;
              const formaLabel = formaPagamentoLabel(l.forma_pagamento);

              return (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      {descricaoValeVisivel(l.descricao) || l.descricao || l.categoria}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(l.data)} · {l.categoria}
                    </p>

                    {temPixDinheiro && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        {b.pix > 0.009 && (
                          <span className="text-cyan-400">Pix {formatCurrency(b.pix)}</span>
                        )}
                        {b.pix > 0.009 && b.dinheiro > 0.009 && (
                          <span className="mx-1.5 text-slate-600">·</span>
                        )}
                        {b.dinheiro > 0.009 && (
                          <span className="text-amber-400">
                            Dinheiro {formatCurrency(b.dinheiro)}
                          </span>
                        )}
                      </p>
                    )}

                    {!temPixDinheiro && formaLabel && l.tipo === "entrada" && (
                      <p className="mt-1 text-xs text-slate-500">{formaLabel}</p>
                    )}

                    {l.visita_id && (
                      <Link
                        href={`/coletas/visita/${l.visita_id}`}
                        className="mt-1 inline-block text-xs text-primary-neon hover:underline"
                      >
                        Ver visita →
                      </Link>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`font-semibold tabular-nums ${
                        l.tipo === "entrada" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {l.tipo === "entrada" ? "+" : "−"}
                      {formatCurrency(Number(l.valor))}
                    </p>
                    <AlertBadge variant={l.tipo === "entrada" ? "success" : "danger"}>
                      {l.tipo}
                    </AlertBadge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
