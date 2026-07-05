"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Financeiro } from "@/lib/types/database";
import {
  breakdownLancamento,
  formaPagamentoLabel,
  somarDescontos,
  type VisitaFinanceiro,
} from "@/lib/financeiro/breakdown";
import {
  dataNoPeriodo,
  periodoLabels,
  type PeriodoFiltro,
} from "@/lib/financeiro/periodo";
import { Gift, Info, Wallet } from "lucide-react";

type FinanceiroRow = Financeiro & {
  visita_id?: string | null;
  visitas?: VisitaFinanceiro;
};

type VisitaResumo = {
  id: string;
  desconto: number | null;
  desconto_recebimento: number | null;
  created_at: string;
};

const periodos: PeriodoFiltro[] = ["hoje", "7d", "30d", "tudo"];

function StatCard({
  label,
  value,
  color,
  sub,
  href,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  href?: string;
}) {
  const card = (
    <div
      className={`glass-card p-4 border h-full w-full min-h-[5.5rem] ${color} ${
        href ? "transition hover:border-orange-500/45 hover:bg-slate-800/40 cursor-pointer" : ""
      }`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {href && <p className="text-[11px] text-primary-neon/80 mt-2">Ver detalhes →</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }

  return card;
}

export function FinanceiroDashboard({
  lancamentos,
  visitas,
  dividasAbatidasHistorico,
}: {
  lancamentos: FinanceiroRow[];
  visitas: VisitaResumo[];
  dividasAbatidasHistorico: number;
}) {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("hoje");

  const metrics = useMemo(() => {
    const rows = lancamentos.filter((l) => dataNoPeriodo(l.data, periodo));
    const visitasPeriodo = visitas.filter((v) => dataNoPeriodo(v.created_at, periodo));
    const descontos = somarDescontos(visitasPeriodo);

    const entradas = rows
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = rows
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);

    let totalPix = 0;
    let totalDinheiro = 0;
    let totalRecuperadoNegativo = 0;

    for (const l of rows) {
      const b = breakdownLancamento(l);
      if (l.tipo === "entrada") {
        totalPix += b.pix;
        totalDinheiro += b.dinheiro;
        totalRecuperadoNegativo += b.debitoAbatido;
      } else if (l.tipo === "saida") {
        totalPix -= b.pix;
        totalDinheiro -= b.dinheiro;
      }
    }

    const potencialCobrado = entradas + descontos.recebimento;
    const taxaCobrada =
      potencialCobrado > 0.009 ? Math.round((entradas / potencialCobrado) * 100) : 100;

    return {
      rows,
      descontos,
      entradas,
      saidas,
      lucro: entradas - saidas,
      totalPix,
      totalDinheiro,
      totalRecuperadoNegativo,
      dividasAbatidasHistorico,
      potencialCobrado,
      taxaCobrada,
    };
  }, [lancamentos, visitas, periodo, dividasAbatidasHistorico]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {periodos.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodo(p)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              periodo === p
                ? "bg-primary-neon/20 text-primary-neon border border-primary-neon/40"
                : "text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {periodoLabels[p]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Caixa</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 items-stretch">
          <StatCard
            label="Entradas"
            value={formatCurrency(metrics.entradas)}
            color="border-green-500/20"
          />
          <StatCard
            label="Saídas"
            value={formatCurrency(metrics.saidas)}
            color="border-red-500/20"
          />
          <StatCard
            label="Lucro líquido"
            value={formatCurrency(metrics.lucro)}
            color="border-blue-500/20"
            sub="Dinheiro real que entrou"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Composição das entradas
        </p>
        <div className="grid gap-3 grid-cols-2 items-stretch">
          <StatCard
            label="Pix"
            value={formatCurrency(metrics.totalPix)}
            color="border-cyan-500/20"
          />
          <StatCard
            label="Dinheiro"
            value={formatCurrency(metrics.totalDinheiro)}
            color="border-amber-500/20"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Operação cassino
        </p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 items-stretch">
          <StatCard
            label="Recuperado de negativo"
            value={formatCurrency(metrics.totalRecuperadoNegativo)}
            color="border-orange-500/20"
            href={`/financeiro/negativos?periodo=${periodo}`}
          />
          <StatCard
            label="Dívidas abatidas"
            value={formatCurrency(metrics.dividasAbatidasHistorico)}
            color="border-purple-500/20"
            sub="Histórico total"
          />
          <div className="glass-card p-4 border border-rose-500/25 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-rose-400" />
              <p className="text-sm text-slate-400">Abatimentos no acerto</p>
            </div>
            <p className="text-xl font-bold text-rose-300">
              {formatCurrency(metrics.descontos.total)}
            </p>
            {(metrics.descontos.manual > 0.009 || metrics.descontos.recebimento > 0.009) && (
              <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                {metrics.descontos.recebimento > 0.009 && (
                  <p>
                    Descontos concedidos:{" "}
                    <span className="text-rose-400">
                      {formatCurrency(metrics.descontos.recebimento)}
                    </span>
                  </p>
                )}
                {metrics.descontos.manual > 0.009 && (
                  <p>
                    Deixado no ponto:{" "}
                    <span className="text-orange-400">
                      {formatCurrency(metrics.descontos.manual)}
                    </span>
                  </p>
                )}
              </div>
            )}
            {metrics.descontos.total > 0.009 && metrics.entradas > 0.009 && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-primary-neon"
                    style={{ width: `${metrics.taxaCobrada}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {metrics.taxaCobrada}% cobrado do valor da operação
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {metrics.descontos.total > 0.009 && (
        <div className="flex gap-2 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400">
          <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
          <p>
            Abatimentos no acerto são <strong className="text-slate-300">receita aberta mão</strong>,
            não saída de caixa. O lucro líquido já reflete o que foi efetivamente recebido.
          </p>
        </div>
      )}

      {metrics.rows.length === 0 ? (
        <EmptyState
          title="Nada neste período"
          description={`Nenhum lançamento em ${periodoLabels[periodo].toLowerCase()}.`}
          icon={<Wallet className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Lançamentos
          </p>
          {metrics.rows.map((l) => {
            const b = breakdownLancamento(l);
            const temPixDinheiro = b.pix > 0.009 || b.dinheiro > 0.009;
            const temAbatimento = b.debitoAbatido > 0.009;
            const temDesconto = b.descontoTotal > 0.009;
            const formaLabel = formaPagamentoLabel(l.forma_pagamento);

            return (
              <div
                key={l.id}
                className="glass-card p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{l.descricao ?? l.categoria}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(l.data)} · {l.categoria}
                  </p>

                  {temPixDinheiro && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {b.pix > 0.009 && (
                        <span className="text-cyan-400">Pix {formatCurrency(b.pix)}</span>
                      )}
                      {b.pix > 0.009 && b.dinheiro > 0.009 && (
                        <span className="text-slate-600 mx-1.5">·</span>
                      )}
                      {b.dinheiro > 0.009 && (
                        <span className="text-amber-400">
                          Dinheiro {formatCurrency(b.dinheiro)}
                        </span>
                      )}
                    </p>
                  )}

                  {!temPixDinheiro && formaLabel && l.tipo === "entrada" && (
                    <p className="text-xs text-slate-500 mt-1">{formaLabel}</p>
                  )}

                  {temDesconto && (
                    <p className="text-xs mt-1 text-rose-400/90">
                      Desconto {formatCurrency(b.descontoTotal)}
                      {b.descontoManual > 0.009 && b.descontoRecebimento > 0.009 && (
                        <>
                          {" "}
                          <span className="text-slate-600">·</span> no ponto{" "}
                          {formatCurrency(b.descontoManual)} · no receb.{" "}
                          {formatCurrency(b.descontoRecebimento)}
                        </>
                      )}
                      {b.descontoManual > 0.009 && b.descontoRecebimento <= 0.009 && (
                        <> · deixado no ponto</>
                      )}
                      {b.descontoRecebimento > 0.009 && b.descontoManual <= 0.009 && (
                        <> · no recebimento</>
                      )}
                    </p>
                  )}

                  {temAbatimento && (
                    <p className="text-xs mt-1">
                      <span className="text-orange-400">
                        Recuperado de negativo: {formatCurrency(b.debitoAbatido)}
                      </span>
                    </p>
                  )}

                  {l.visita_id && (
                    <Link
                      href={`/coletas/visita/${l.visita_id}`}
                      className="inline-block text-xs text-primary-neon hover:underline mt-1"
                    >
                      Ver visita cassino →
                    </Link>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`font-semibold ${l.tipo === "entrada" ? "text-green-400" : "text-red-400"}`}
                  >
                    {l.tipo === "entrada" ? "+" : "-"}
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
    </div>
  );
}
