"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { descricaoValeVisivel } from "@/lib/equipe/vale-staff";
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
import {
  reconciliarComposicaoExibida,
  type ComposicaoCaixa,
} from "@/lib/financeiro/saldo-caixa";
import { Wallet } from "lucide-react";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fin-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-fin-sans",
});

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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function FinanceiroDashboard({
  lancamentos,
  visitas,
  composicao,
}: {
  lancamentos: FinanceiroRow[];
  visitas: VisitaResumo[];
  composicao: ComposicaoCaixa;
}) {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("hoje");

  const caixa = useMemo(
    () => reconciliarComposicaoExibida(composicao),
    [composicao]
  );

  const pctPix =
    caixa.saldo > 0.009 ? Math.round((caixa.pix / caixa.saldo) * 100) : 0;
  const pctDinheiro =
    caixa.saldo > 0.009 ? Math.round((caixa.dinheiro / caixa.saldo) * 100) : 0;

  const movimento = useMemo(() => {
    const rows = lancamentos.filter((l) => dataNoPeriodo(l.data, periodo));
    const visitasPeriodo = visitas.filter((v) =>
      dataNoPeriodo(v.created_at, periodo)
    );
    const descontos = somarDescontos(visitasPeriodo);

    const entradas = rows
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = rows
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);

    return {
      rows,
      entradas: round2(entradas),
      saidas: round2(saidas),
      resultado: round2(entradas - saidas),
      descontoRecebimento: round2(descontos.recebimento),
      deixadoNoPonto: round2(descontos.manual),
      abatimentosTotal: round2(descontos.total),
    };
  }, [lancamentos, visitas, periodo]);

  const hoje = useMemo(() => {
    const rows = lancamentos.filter((l) => dataNoPeriodo(l.data, "hoje"));
    const visitasHoje = visitas.filter((v) => dataNoPeriodo(v.created_at, "hoje"));
    const descontos = somarDescontos(visitasHoje);
    const entradas = rows
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = rows
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);
    return {
      entradas: round2(entradas),
      saidas: round2(saidas),
      descontoRecebimento: round2(descontos.recebimento),
      deixadoNoPonto: round2(descontos.manual),
    };
  }, [lancamentos, visitas]);

  return (
    <div className={cn(display.variable, sans.variable, "space-y-10")}>
      {/* HERO — uma composição */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#c4a574]/25 bg-at-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(196,165,116,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(34,211,238,0.08), transparent 50%), linear-gradient(165deg, #121820 0%, #0b1018 45%, #0a0e14 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
          <p
            className="text-[11px] uppercase tracking-[0.28em] text-at-link/90"
            style={{ fontFamily: "var(--font-fin-sans), system-ui, sans-serif" }}
          >
            Caixa agora
          </p>
          <h2
            className="mt-3 text-[clamp(2.75rem,8vw,4.5rem)] leading-[0.92] tracking-tight text-at-primary"
            style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
          >
            {formatCurrency(caixa.saldo)}
          </h2>
          <p
            className="mt-3 max-w-md text-sm text-at-muted"
            style={{ fontFamily: "var(--font-fin-sans), system-ui, sans-serif" }}
          >
            O que você tem disponível — Pix e dinheiro somam este saldo.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
                  Pix
                </span>
                <span
                  className="text-2xl tabular-nums text-cyan-200"
                  style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
                >
                  {formatCurrency(caixa.pix)}
                </span>
              </div>
              <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-at-card-soft">
                <div
                  className="h-full rounded-full bg-cyan-400/80 transition-all duration-700"
                  style={{ width: `${pctPix}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80">
                  Dinheiro
                </span>
                <span
                  className="text-2xl tabular-nums text-amber-100"
                  style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
                >
                  {formatCurrency(caixa.dinheiro)}
                </span>
              </div>
              <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-at-card-soft">
                <div
                  className="h-full rounded-full bg-amber-300/75 transition-all duration-700"
                  style={{ width: `${pctDinheiro}%` }}
                />
              </div>
            </div>
          </div>

          {caixa.residual > 0.05 && (
            <p className="mt-5 text-xs text-at-muted">
              + {formatCurrency(caixa.residual)} ainda sem forma definida no histórico
            </p>
          )}
        </div>
      </section>

      {/* HOJE */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 border-b border-at pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-at-muted">Hoje</p>
            <h3
              className="mt-1 text-2xl text-at-primary"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              Movimento do dia
            </h3>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400/70">
              Entrou
            </p>
            <p
              className="mt-2 text-4xl tabular-nums tracking-tight text-emerald-300"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              {formatCurrency(hoje.entradas)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-rose-400/70">
              Saiu
            </p>
            <p
              className="mt-2 text-4xl tabular-nums tracking-tight text-rose-300"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              {formatCurrency(hoje.saidas)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 border-t border-at pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/70">
              Descontos dados
            </p>
            <p
              className="mt-1.5 text-xl tabular-nums text-rose-200/90"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              {formatCurrency(hoje.descontoRecebimento)}
            </p>
            <p className="mt-1 text-xs text-at-muted">No recebimento das coletas de hoje</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-orange-300/70">
              Deixado no ponto
            </p>
            <p
              className="mt-1.5 text-xl tabular-nums text-orange-200/90"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              {formatCurrency(hoje.deixadoNoPonto)}
            </p>
            <p className="mt-1 text-xs text-at-muted">
              Adiantamento / valor deixado nas visitas de hoje
            </p>
          </div>
        </div>
      </section>

      {/* PERÍODO + LISTA */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-at pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-at-muted">
              Histórico
            </p>
            <h3
              className="mt-1 text-2xl text-at-primary"
              style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
            >
              Lançamentos
            </h3>
            <p className="mt-1 text-sm text-at-muted">
              O filtro não altera o saldo do caixa acima
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {periodos.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-[12px] tracking-wide transition",
                  periodo === p
                    ? "bg-[#c4a574]/15 text-at-link ring-1 ring-[#c4a574]/35"
                    : "text-at-muted hover:text-at-primary/85"
                )}
              >
                {periodoLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Metric label="Entradas" value={movimento.entradas} tone="emerald" />
          <Metric label="Saídas" value={movimento.saidas} tone="rose" />
          <Metric
            label="Descontos"
            value={movimento.descontoRecebimento}
            tone="rose"
          />
          <Metric
            label="Deixado no ponto"
            value={movimento.deixadoNoPonto}
            tone="orange"
          />
        </div>

        <Link
          href={`/financeiro/negativos?periodo=${periodo}`}
          className="inline-block text-sm text-at-link hover:underline"
        >
          Negativos recuperados →
        </Link>

        {movimento.rows.length === 0 ? (
          <EmptyState
            title="Nada neste período"
            description={`Nenhum lançamento em ${periodoLabels[periodo].toLowerCase()}.`}
            icon={<Wallet className="h-8 w-8" />}
          />
        ) : (
          <ul className="divide-y divide-white/[0.05] border-t border-at">
            {movimento.rows.map((l) => {
              const b = breakdownLancamento(l);
              const temPixDinheiro = b.pix > 0.009 || b.dinheiro > 0.009;
              const formaLabel = formaPagamentoLabel(l.forma_pagamento);
              const entrada = l.tipo === "entrada";

              return (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-4 py-4 first:pt-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-at-primary">
                      {descricaoValeVisivel(l.descricao) || l.descricao || l.categoria}
                    </p>
                    <p className="mt-0.5 text-[12px] text-at-muted">
                      {formatDate(l.data)} · {l.categoria}
                      {temPixDinheiro && (
                        <>
                          {" · "}
                          {b.pix > 0.009 && (
                            <span className="text-cyan-400/90">
                              Pix {formatCurrency(b.pix)}
                            </span>
                          )}
                          {b.pix > 0.009 && b.dinheiro > 0.009 && " · "}
                          {b.dinheiro > 0.009 && (
                            <span className="text-amber-400/90">
                              Dinheiro {formatCurrency(b.dinheiro)}
                            </span>
                          )}
                        </>
                      )}
                      {!temPixDinheiro && formaLabel ? ` · ${formaLabel}` : null}
                    </p>
                    {l.visita_id && (
                      <Link
                        href={`/coletas/visita/${l.visita_id}`}
                        className="mt-1 inline-block text-[12px] text-at-link/90 hover:underline"
                      >
                        Ver visita →
                      </Link>
                    )}
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-[15px] tabular-nums",
                      entrada ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {entrada ? "+" : "−"}
                    {formatCurrency(Number(l.valor))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "orange";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "orange"
        ? "text-orange-200"
        : "text-rose-300";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-at-muted">{label}</p>
      <p
        className={cn("mt-1 text-lg tabular-nums sm:text-xl", color)}
        style={{ fontFamily: "var(--font-fin-display), Georgia, serif" }}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
