"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { CentroInteligencia } from "@/components/analise/CentroInteligencia";
import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import { SaudePontosPainel } from "@/components/analise/SaudePontosPainel";
import { TermoHint } from "@/components/ui/TermoHint";
import type {
  InteligenciaOperacional,
  RankingCidade,
  RankingMaquina,
  RankingPonto,
} from "@/lib/analise/inteligencia-operacional";
import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";

function entradaPonto(p: RankingPonto): number {
  return Number(p.entrada ?? p.bruto ?? 0);
}

function saidaPonto(p: RankingPonto): number {
  return Number(p.saida ?? 0);
}

/** % pago do ponto (saída ÷ entrada). Null se não há entrada. */
function pctPagoPonto(p: RankingPonto): number | null {
  const ent = entradaPonto(p);
  if (ent <= 0.009) return null;
  return Math.round((saidaPonto(p) / ent) * 1000) / 10;
}

/** rankingMaquinas consolidado (cassino) grava entrada/saída em centavos. */
function entradaMaquinaReais(m: RankingMaquina): number {
  return m.entrada / 100;
}

function saidaMaquinaReais(m: RankingMaquina): number {
  return m.saida / 100;
}

function pctPagoMaquina(m: RankingMaquina): number | null {
  if (m.pctPago != null) return m.pctPago;
  const ent = entradaMaquinaReais(m);
  if (ent <= 0.009) return null;
  return Math.round((saidaMaquinaReais(m) / ent) * 1000) / 10;
}

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-analise-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-analise-sans",
});

const ACCENT = "#c4a574";

type AnaliseTab = "resumo" | "pontos" | "cidades" | "maquinas" | "sinais" | "detalhe";

type Props = {
  data: InteligenciaOperacional;
  periodo: PeriodoAnaliseRange;
  comissaoStaff?: {
    total: number;
    totalVales: number;
    totalAPagar: number;
    linhas: {
      nome: string;
      percentual: number;
      valor: number;
      vales: number;
      aPagar: number;
    }[];
  } | null;
};

function moneyTone(n: number) {
  if (n > 0.009) return "text-emerald-400/95";
  if (n < -0.009) return "text-rose-400/95";
  return "text-[#f4efe6]/80";
}

function CityBar({
  cidade,
  maxAbs,
  index,
}: {
  cidade: RankingCidade;
  maxAbs: number;
  index: number;
}) {
  const width =
    maxAbs > 0 ? Math.max(6, Math.min(100, (Math.abs(cidade.lucro) / maxAbs) * 100)) : 6;
  const positive = cidade.lucro >= 0;

  return (
    <div
      className="border-b border-white/[0.04] py-4 last:border-0"
      style={{
        animation: `analiseRise 0.55s ${0.04 * index}s ease-out both`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-medium text-[#f4efe6]">{cidade.cidade}</p>
          <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
            {cidade.pontos} ponto{cidade.pontos === 1 ? "" : "s"} · {cidade.movimentos} mov.
            {cidade.shareLucroPct != null
              ? ` · ${cidade.shareLucroPct.toFixed(1)}% da operação`
              : " —"}
            {cidade.margemPct != null ? ` · margem ${cidade.margemPct.toFixed(1)}%` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-[15px] font-semibold tabular-nums", moneyTone(cidade.lucro))}>
            {formatCurrency(cidade.lucro)}
          </p>
          <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
            entrada {formatCurrency(cidade.bruto || cidade.dinheiroOperacao)}
          </p>
        </div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${width}%`,
            background: positive
              ? `linear-gradient(90deg, rgba(168,137,90,0.35), ${ACCENT} 55%, #e8d5b0)`
              : "linear-gradient(90deg, rgba(251,113,133,0.25), rgba(251,113,133,0.9))",
            boxShadow: positive
              ? "0 0 16px rgba(196,165,116,0.35)"
              : "0 0 12px rgba(251,113,133,0.25)",
            transition: "width 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

type PontoRankMetric = "movimento" | "pago" | "bolso";

function PontoRankCard({
  ponto,
  rank,
  variant,
  metric,
}: {
  ponto: RankingPonto;
  rank: number;
  variant: "best" | "worst";
  metric: PontoRankMetric;
}) {
  const ent = entradaPonto(ponto);
  const sai = saidaPonto(ponto);
  const pct = pctPagoPonto(ponto);

  const destaque =
    metric === "movimento"
      ? formatCurrency(ent)
      : metric === "pago"
        ? pct != null
          ? `${pct.toFixed(1)}%`
          : "—"
        : formatCurrency(ponto.lucro);

  const destaqueTone =
    metric === "pago"
      ? variant === "best"
        ? "text-amber-300/95"
        : "text-cyan-300/90"
      : moneyTone(metric === "bolso" ? ponto.lucro : ent);

  return (
    <Link
      href={`/pontos/${ponto.pontoId}`}
      className="block border-b border-white/[0.04] py-3.5 transition last:border-0 hover:bg-white/[0.02]"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-[12px] font-medium tabular-nums",
            variant === "best" ? "text-emerald-400/70" : "text-rose-400/70"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-[#f4efe6]">{ponto.nome}</p>
              <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                {ponto.movimentos} mov.
                {metric === "bolso" && ponto.lucroPorMovimento != null
                  ? ` · ${formatCurrency(ponto.lucroPorMovimento)}/coleta`
                  : ""}
                {metric === "pago" && ent > 0.009
                  ? ` · ent ${formatCurrency(ent)} · sai ${formatCurrency(sai)}`
                  : ""}
                {metric === "movimento" && sai > 0.009
                  ? ` · sai ${formatCurrency(sai)}`
                  : ""}
              </p>
            </div>
            <p className={cn("shrink-0 text-[15px] font-semibold tabular-nums", destaqueTone)}>
              {destaque}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            <div>
              <p>Entrada</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {formatCurrency(ent)}
              </p>
            </div>
            <div>
              <p>Saída</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {formatCurrency(sai)}
              </p>
            </div>
            <div>
              <p>{metric === "bolso" ? "Seu bolso" : "% pago"}</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {metric === "bolso"
                  ? formatCurrency(ponto.lucro)
                  : pct != null
                    ? `${pct.toFixed(1)}%`
                    : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankCol({
  title,
  hint,
  icon: Icon,
  items,
  variant,
  metric,
  empty,
}: {
  title: string;
  hint?: string;
  icon: typeof TrendingUp;
  items: RankingPonto[];
  variant: "best" | "worst";
  metric: PontoRankMetric;
  empty: string;
}) {
  return (
    <div className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-4 py-2 sm:px-5">
      <div className="border-b border-white/[0.05] py-3">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4",
              metric === "pago" && variant === "best"
                ? "text-amber-400/85"
                : variant === "best"
                  ? "text-emerald-400/80"
                  : "text-rose-400/80"
            )}
          />
          <h3 className="text-[14px] font-medium tracking-wide text-[#f4efe6]">{title}</h3>
          <span className="ml-auto text-[12px] tabular-nums text-slate-500">{items.length}</span>
        </div>
        {hint ? <p className="mt-1 text-[12px] text-slate-500">{hint}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-[15px] text-slate-500">{empty}</p>
      ) : (
        items.map((p, i) => (
          <PontoRankCard
            key={`${metric}-${p.pontoId}`}
            ponto={p}
            rank={i + 1}
            variant={variant}
            metric={metric}
          />
        ))
      )}
    </div>
  );
}

function MaquinaRankRow({
  maquina,
  rank,
  variant,
  metric,
}: {
  maquina: RankingMaquina;
  rank: number;
  variant: "best" | "worst";
  metric: "movimento" | "pago";
}) {
  const ent = entradaMaquinaReais(maquina);
  const sai = saidaMaquinaReais(maquina);
  const pct = pctPagoMaquina(maquina);
  const destaque =
    metric === "movimento"
      ? formatCurrency(ent)
      : pct != null
        ? `${pct.toFixed(1)}%`
        : "—";

  return (
    <div className="border-b border-white/[0.04] py-3.5 last:border-0">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-[12px] font-medium tabular-nums",
            variant === "best" ? "text-emerald-400/70" : "text-amber-400/80"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-[#f4efe6]">
                {maquina.nome}
                {maquina.numeroMaquina ? (
                  <span className="text-slate-500"> · #{maquina.numeroMaquina}</span>
                ) : null}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-slate-500">
                {maquina.pontoNome} · {maquina.leituras} leitura
                {maquina.leituras === 1 ? "" : "s"}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 text-[15px] font-semibold tabular-nums",
                metric === "pago" ? "text-amber-300/95" : "text-[#f4efe6]"
              )}
            >
              {destaque}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            <div>
              <p>Entrada</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {formatCurrency(ent)}
              </p>
            </div>
            <div>
              <p>Saída</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {formatCurrency(sai)}
              </p>
            </div>
            <div>
              <p>% pago</p>
              <p className="mt-0.5 text-[13px] font-medium normal-case tracking-normal tabular-nums text-slate-300">
                {pct != null ? `${pct.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalisePremiumClient({ data, periodo, comissaoStaff = null }: Props) {
  const [ativo, setAtivo] = useState(false);
  const [aba, setAba] = useState<AnaliseTab>("resumo");
  const modulosRef = useRef<HTMLElement | null>(null);
  const v = data.visaoGeral;
  const liquido = v.liquidoOperacao ?? v.lucroLiquido;
  const entrada = v.entrada ?? v.faturamentoBruto;
  const saida = v.saida ?? 0;
  const comissao = v.comissao ?? 0;
  const movimento = v.liquidoMovimento ?? entrada - saida;

  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const comMovimento = useMemo(
    () => data.rankingPontos.filter((p) => p.movimentos >= 1 || Math.abs(p.lucro) > 0.009),
    [data.rankingPontos]
  );

  const comEntrada = useMemo(
    () => comMovimento.filter((p) => entradaPonto(p) > 0.009),
    [comMovimento]
  );

  const RANK_TOP = 10;

  const maiorMovimento = useMemo(
    () => [...comEntrada].sort((a, b) => entradaPonto(b) - entradaPonto(a)).slice(0, RANK_TOP),
    [comEntrada]
  );

  const menorMovimento = useMemo(() => {
    if (comEntrada.length < 2) return [];
    const idsTop = new Set(
      maiorMovimento.slice(0, Math.min(3, maiorMovimento.length)).map((p) => p.pontoId)
    );
    return [...comEntrada]
      .sort((a, b) => entradaPonto(a) - entradaPonto(b))
      .filter((p) => !idsTop.has(p.pontoId))
      .slice(0, RANK_TOP);
  }, [comEntrada, maiorMovimento]);

  const comPctPago = useMemo(
    () =>
      comEntrada
        .map((p) => ({ p, pct: pctPagoPonto(p) }))
        .filter((x): x is { p: RankingPonto; pct: number } => x.pct != null),
    [comEntrada]
  );

  const maisPaga = useMemo(
    () => [...comPctPago].sort((a, b) => b.pct - a.pct).slice(0, RANK_TOP).map((x) => x.p),
    [comPctPago]
  );

  const menosPaga = useMemo(() => {
    if (comPctPago.length < 2) return [];
    const idsTop = new Set(
      maisPaga.slice(0, Math.min(3, maisPaga.length)).map((p) => p.pontoId)
    );
    return [...comPctPago]
      .sort((a, b) => a.pct - b.pct)
      .map((x) => x.p)
      .filter((p) => !idsTop.has(p.pontoId))
      .slice(0, RANK_TOP);
  }, [comPctPago, maisPaga]);

  const maisTeDeixa = useMemo(
    () =>
      [...comMovimento]
        .filter((p) => p.lucro > 0.009)
        .sort((a, b) => b.lucro - a.lucro)
        .slice(0, RANK_TOP),
    [comMovimento]
  );

  const menosTeDeixa = useMemo(() => {
    const porLucroAsc = [...comMovimento].sort((a, b) => a.lucro - b.lucro);
    const negativos = porLucroAsc.filter((p) => p.lucro < -0.009);
    if (negativos.length) return negativos.slice(0, RANK_TOP);
    if (comMovimento.length < 2) return [];
    const idsMelhores = new Set(
      maisTeDeixa.slice(0, Math.min(3, maisTeDeixa.length)).map((m) => m.pontoId)
    );
    return porLucroAsc.filter((p) => !idsMelhores.has(p.pontoId)).slice(0, RANK_TOP);
  }, [comMovimento, maisTeDeixa]);

  const maquinas = useMemo(() => {
    const list = data.cassino?.rankingMaquinas ?? [];
    const comEnt = list.filter((m) => entradaMaquinaReais(m) > 0.009);
    const porMov = [...comEnt].sort(
      (a, b) => entradaMaquinaReais(b) - entradaMaquinaReais(a)
    );
    const comPct = comEnt
      .map((m) => ({ m, pct: pctPagoMaquina(m) }))
      .filter((x): x is { m: RankingMaquina; pct: number } => x.pct != null);
    const porPagoDesc = [...comPct].sort((a, b) => b.pct - a.pct).map((x) => x.m);
    const idsMaisPaga = new Set(
      porPagoDesc.slice(0, Math.min(3, porPagoDesc.length)).map((m) => m.equipamentoId)
    );
    const porPagoBaixo =
      comPct.length < 2
        ? []
        : [...comPct]
            .sort((a, b) => a.pct - b.pct)
            .map((x) => x.m)
            .filter((m) => !idsMaisPaga.has(m.equipamentoId));
    return {
      maisMovimento: porMov.slice(0, RANK_TOP),
      maisPaga: porPagoDesc.slice(0, RANK_TOP),
      menosPaga: porPagoBaixo.slice(0, RANK_TOP),
    };
  }, [data.cassino?.rankingMaquinas]);

  const maxCidadeAbs = useMemo(
    () => Math.max(0, ...data.rankingCidades.map((c) => Math.abs(c.lucro))),
    [data.rankingCidades]
  );

  const capitalTotal = v.valorEstoqueCentral + v.valorBrindesPontos;
  const temCidadesNomeadas = data.rankingCidades.some((c) => c.cidade !== "Sem cidade");
  const cmp = data.comparativo;
  const saude = data.saudePontos ?? [];

  const fortes = saude.filter((p) => p.classe === "forte").length;
  const razoaveis = saude.filter((p) => p.classe === "razoavel").length;
  const fracos = saude.filter((p) => p.classe === "fraco").length;
  const umNichoSo =
    [
      data.nichos.furaFura,
      data.nichos.ursinho,
      data.nichos.cassino,
      data.nichos.diversao,
      data.nichos.bolinha,
      data.nichos.consignado,
    ].filter(Boolean).length === 1;

  const temMaquinas =
    maquinas.maisMovimento.length > 0 || maquinas.maisPaga.length > 0;

  const abas = useMemo(() => {
    const list: { id: AnaliseTab; label: string }[] = [
      { id: "resumo", label: "Resumo" },
      { id: "pontos", label: "Pontos" },
      { id: "cidades", label: "Cidades" },
    ];
    if (temMaquinas) list.push({ id: "maquinas", label: "Máquinas" });
    if (data.insights.length > 0) list.push({ id: "sinais", label: "Sinais" });
    list.push({ id: "detalhe", label: umNichoSo ? "Raio-X" : "Detalhe" });
    return list;
  }, [data.insights.length, temMaquinas, umNichoSo]);

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 text-[15px] sm:-mx-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)]"
      )}
      style={{ fontFamily: "var(--font-analise-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 50% at 50% -8%, rgba(196,165,116,0.14), transparent 55%), radial-gradient(ellipse 45% 35% at 95% 25%, rgba(16,185,129,0.05), transparent 50%), radial-gradient(ellipse 40% 30% at 5% 70%, rgba(120,90,50,0.1), transparent 45%), linear-gradient(180deg, #06080e 0%, #0a0e16 50%, #07090f 100%)",
          }}
        />
      </div>

      <style>{`
        @keyframes analiseRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes analiseLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <header
          className={cn("transition-opacity duration-700", ativo ? "opacity-100" : "opacity-0")}
          style={{ animation: ativo ? "analiseRise 0.85s ease-out both" : undefined }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                className="text-[12px] font-medium uppercase text-[#c4a574]/90"
                style={{ letterSpacing: "0.38em" }}
              >
                OperaRoute · Private desk
              </p>
              <h1
                className="mt-3 text-[clamp(2.55rem,6.2vw,3.9rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                Análise
              </h1>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-400">
                Leitura real da operação — o que entrou, o que saiu (incluindo
                negativo pago com caixa) e o líquido do período, mesmo abaixo de
                zero.
              </p>
            </div>
            <div className="lg:max-w-xl lg:flex-1">
              <PeriodoAnaliseSelector atual={periodo} tema="premium" />
            </div>
          </div>
          <div
            className="mt-8 h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/60 via-white/10 to-transparent"
            style={{ animation: ativo ? "analiseLine 1s 0.25s ease-out both" : undefined }}
          />
        </header>

        {/* Navegação por abas */}
        <nav
          className="sticky top-0 z-20 -mx-4 mt-6 border-b border-white/[0.06] bg-[#06080e]/92 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
          aria-label="Seções da análise"
        >
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {abas.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAba(tab.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-medium transition",
                  aba === tab.id
                    ? "border-[#c4a574]/40 bg-[#c4a574]/15 text-[#c4a574]"
                    : "border-white/[0.08] text-slate-400 hover:border-[#c4a574]/25 hover:text-[#f4efe6]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {aba === "resumo" && (
        <section
          className="mt-10"
          style={{ animation: ativo ? "analiseRise 0.7s 0.12s ease-out both" : undefined }}
        >
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-[12px] uppercase tracking-[0.22em] text-slate-500">
                Líquido real · {data.periodoLabel}
              </p>
              <p
                className={cn(
                  "mt-2 text-[clamp(2.9rem,7.2vw,4.4rem)] font-normal leading-none tracking-tight tabular-nums",
                  moneyTone(liquido)
                )}
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                {formatCurrency(liquido)}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                O que você recebeu / ficou na operação neste período.
              </p>

              {cmp && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    {cmp.liquidoOperacaoDelta >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400/80" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-rose-400/80" />
                    )}
                    <span className={cn("tabular-nums", moneyTone(cmp.liquidoOperacaoDelta))}>
                      {cmp.liquidoOperacaoDelta >= 0 ? "+" : ""}
                      {formatCurrency(cmp.liquidoOperacaoDelta)}
                    </span>
                    {cmp.liquidoOperacaoDeltaPct != null && (
                      <span className="tabular-nums text-slate-500">
                        ({cmp.liquidoOperacaoDeltaPct >= 0 ? "+" : ""}
                        {cmp.liquidoOperacaoDeltaPct.toFixed(0)}%)
                      </span>
                    )}
                  </span>
                  <span className="text-slate-600">vs período anterior</span>
                </div>
              )}

              <div className="mt-6 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
                {[
                  {
                    label: "Entrada",
                    value: formatCurrency(entrada),
                    hint: "Máquinas faturaram",
                    tone: "text-emerald-400/90",
                  },
                  {
                    label: "Saída",
                    value: formatCurrency(saida),
                    hint: "Saiu das máquinas",
                    tone: "text-rose-400/90",
                  },
                  {
                    label: "Comissão",
                    value: formatCurrency(comissao),
                    hint: "Parte do cliente",
                    tone: "text-amber-300/90",
                  },
                  {
                    label: "Movimento",
                    value: formatCurrency(movimento),
                    hint: "Entrada − saída",
                    tone: "text-[#f4efe6]",
                  },
                ].map((cell) => (
                  <div key={cell.label} className="bg-[#0a0e16]/95 px-3 py-3.5 sm:px-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      {cell.label}
                    </p>
                    <p className={cn("mt-1.5 text-[16px] font-medium tabular-nums", cell.tone)}>
                      {cell.value}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">{cell.hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-slate-400">
                {v.margemPct != null && (
                  <span>
                    Margem{" "}
                    <span className="tabular-nums text-[#f4efe6]">{v.margemPct.toFixed(1)}%</span>
                  </span>
                )}
                <span>
                  Brindes{" "}
                  <span className="tabular-nums text-[#f4efe6]">
                    {formatCurrency(v.custoBrindesMes)}
                  </span>
                </span>
                {comissaoStaff && comissaoStaff.linhas.length > 0 && (
                  <span>
                    Ajudante{" "}
                    <span className="tabular-nums text-violet-200">
                      {formatCurrency(
                        comissaoStaff.linhas.length === 1
                          ? comissaoStaff.linhas[0].valor
                          : comissaoStaff.total
                      )}
                    </span>
                    {(comissaoStaff.totalVales > 0.009 || comissaoStaff.totalAPagar > 0.009) && (
                      <>
                        <span className="text-slate-600"> · vales </span>
                        <span className="tabular-nums text-amber-200/90">
                          {formatCurrency(comissaoStaff.totalVales)}
                        </span>
                        <span className="text-slate-600"> · a pagar </span>
                        <span className="tabular-nums text-violet-200">
                          {formatCurrency(comissaoStaff.totalAPagar)}
                        </span>
                      </>
                    )}
                  </span>
                )}
                {cmp && (
                  <span className="text-slate-600">
                    Mov. {cmp.movimentosDelta >= 0 ? "+" : ""}
                    {cmp.movimentosDelta} vs ant.
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06]">
              {[
                { label: "A receber", value: formatCurrency(v.aReceber) },
                {
                  label: "Haver",
                  value: formatCurrency(v.haver),
                  hint: true as const,
                },
                { label: "Capital estoque", value: formatCurrency(capitalTotal) },
                {
                  label: "Pontos c/ movimento",
                  value: String(comMovimento.length),
                },
              ].map((cell) => (
                <div key={cell.label} className="bg-[#0a0e16]/95 px-4 py-3.5">
                  <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {cell.label}
                    {"hint" in cell && cell.hint ? (
                      <TermoHint texto="Crédito que você deve ao ponto — saldo positivo a favor do cliente." />
                    ) : null}
                  </p>
                  <p className="mt-1.5 text-[16px] font-medium tabular-nums text-[#f4efe6]">
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {aba === "cidades" && (
        <section
          className="mt-10"
          style={{ animation: ativo ? "analiseRise 0.7s 0.2s ease-out both" : undefined }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.22em] text-[#c4a574]/85">
                Geografia
              </p>
              <h2
                className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6] sm:text-[2rem]"
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                Por cidade
              </h2>
              <p className="mt-1.5 text-[14px] text-slate-500">
                Participação no líquido da operação · todos os nichos.
              </p>
            </div>
            <p className="text-[13px] tabular-nums text-slate-500">
              {data.rankingCidades.length} praça
              {data.rankingCidades.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-1">
            {data.rankingCidades.length === 0 ? (
              <p className="py-10 text-[15px] text-slate-500">
                Sem movimentos no período para agregar por cidade.
              </p>
            ) : (
              data.rankingCidades.map((c, i) => (
                <CityBar key={c.cidade} cidade={c} maxAbs={maxCidadeAbs} index={i} />
              ))
            )}
          </div>
          {!temCidadesNomeadas && data.rankingCidades.length > 0 && (
            <p className="mt-3 text-[13px] text-slate-500">
              Cadastre a cidade em cada ponto para separar o faturamento por praça.
            </p>
          )}
        </section>
        )}

        {aba === "pontos" && (
        <>
        <section
          className="mt-10"
          style={{ animation: ativo ? "analiseRise 0.7s 0.28s ease-out both" : undefined }}
        >
          <div className="mb-6">
            <p className="text-[12px] uppercase tracking-[0.22em] text-[#c4a574]/85">
              Performance
            </p>
            <h2
              className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6] sm:text-[2rem]"
              style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
            >
              Movimento · pagamento · seu bolso
            </h2>
            <p className="mt-1.5 text-[14px] text-slate-500">
              Período: {periodo.label}. Top 10 — entrada das máquinas, quanto o ponto paga, e o
              que ficou com você.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <p className="mb-3 text-[12px] uppercase tracking-[0.16em] text-slate-500">
                Maior movimento
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                <RankCol
                  title="Maior entrada"
                  hint="Onde as máquinas mais trabalharam"
                  icon={TrendingUp}
                  items={maiorMovimento}
                  variant="best"
                  metric="movimento"
                  empty="Nenhum ponto com entrada no período."
                />
                <RankCol
                  title="Menor entrada"
                  hint="Pontos com menos movimento"
                  icon={TrendingDown}
                  items={menorMovimento}
                  variant="worst"
                  metric="movimento"
                  empty={
                    comEntrada.length < 2
                      ? "Com 1 ponto não tem comparativo de menor entrada."
                      : "Sem dados de entrada."
                  }
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-[12px] uppercase tracking-[0.16em] text-slate-500">
                Quanto paga
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                <RankCol
                  title="Mais paga"
                  hint="Maior % saída ÷ entrada — ponto que devolve mais"
                  icon={TrendingUp}
                  items={maisPaga}
                  variant="best"
                  metric="pago"
                  empty="Sem % pago (falta entrada/saída no período)."
                />
                <RankCol
                  title="Menos paga"
                  hint="Menor % — ponto que retém mais"
                  icon={TrendingDown}
                  items={menosPaga}
                  variant="worst"
                  metric="pago"
                  empty={
                    comPctPago.length < 2
                      ? "Com 1 ponto não tem comparativo de menos paga."
                      : "Sem % pago no período."
                  }
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-[12px] uppercase tracking-[0.16em] text-slate-500">
                Seu bolso
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                <RankCol
                  title="Mais te deixa"
                  hint="Maior lucro / operação no período"
                  icon={TrendingUp}
                  items={maisTeDeixa}
                  variant="best"
                  metric="bolso"
                  empty="Nenhum ponto com lucro positivo."
                />
                <RankCol
                  title={
                    comMovimento.some((p) => p.lucro < -0.009)
                      ? "Menos te deixa"
                      : "Menor rendimento"
                  }
                  hint="Prejuízo ou menor lucro"
                  icon={TrendingDown}
                  items={menosTeDeixa}
                  variant="worst"
                  metric="bolso"
                  empty={
                    comMovimento.length < 2 && !comMovimento.some((p) => p.lucro < -0.009)
                      ? "Com 1 ponto sem prejuízo, não há comparativo."
                      : "Sem dados de pontos no período."
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* Saúde — junto com pontos */}
        <section
          className="mt-14"
          style={{ animation: ativo ? "analiseRise 0.7s 0.32s ease-out both" : undefined }}
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.22em] text-[#c4a574]/85">Base</p>
              <h2
                className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6] sm:text-[2rem]"
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                Saúde dos pontos
              </h2>
              <p className="mt-1.5 text-[14px] text-slate-500">
                Pelo lucro real no período — forte = top da frota, fraco = prejuízo ou cauda baixa.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-[13px] tabular-nums text-slate-500">
              <span>
                Fortes <strong className="text-emerald-400/90">{fortes}</strong>
              </span>
              <span>
                Razoáveis <strong className="text-amber-400/90">{razoaveis}</strong>
              </span>
              <span>
                Fracos <strong className="text-rose-400/90">{fracos}</strong>
              </span>
            </div>
          </div>
          <SaudePontosPainel
            itens={saude}
            titulo="Classificação operacional"
            subtitulo="Lucro real do período selecionado, comparado entre os pontos"
          />
        </section>
        </>
        )}

        {aba === "maquinas" && temMaquinas && (
          <section
            className="mt-10"
            style={{ animation: ativo ? "analiseRise 0.7s 0.3s ease-out both" : undefined }}
          >
            <div className="mb-6">
              <p className="text-[12px] uppercase tracking-[0.22em] text-[#c4a574]/85">
                Máquinas
              </p>
              <h2
                className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6] sm:text-[2rem]"
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                Quem puxa o ponto
              </h2>
              <p className="mt-1.5 text-[14px] text-slate-500">
                Entrada × saída × % pago — alerta quando alguma máquina paga acima do normal.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-4 py-2 sm:px-5">
                <div className="border-b border-white/[0.05] py-3">
                  <h3 className="text-[14px] font-medium tracking-wide text-[#f4efe6]">
                    Mais movimento
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500">Maior entrada no período</p>
                </div>
                {maquinas.maisMovimento.map((m, i) => (
                  <MaquinaRankRow
                    key={`mov-${m.equipamentoId}`}
                    maquina={m}
                    rank={i + 1}
                    variant="best"
                    metric="movimento"
                  />
                ))}
              </div>

              <div className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-4 py-2 sm:px-5">
                <div className="border-b border-white/[0.05] py-3">
                  <h3 className="text-[14px] font-medium tracking-wide text-[#f4efe6]">
                    Mais paga
                  </h3>
                  <p className="mt-1 text-[12px] text-amber-400/80">
                    Maior % saída ÷ entrada — atenção
                  </p>
                </div>
                {maquinas.maisPaga.length === 0 ? (
                  <p className="py-8 text-[15px] text-slate-500">Sem % pago nas máquinas.</p>
                ) : (
                  maquinas.maisPaga.map((m, i) => (
                    <MaquinaRankRow
                      key={`pago-${m.equipamentoId}`}
                      maquina={m}
                      rank={i + 1}
                      variant="best"
                      metric="pago"
                    />
                  ))
                )}
              </div>

              <div className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-4 py-2 sm:px-5">
                <div className="border-b border-white/[0.05] py-3">
                  <h3 className="text-[14px] font-medium tracking-wide text-[#f4efe6]">
                    Menos paga
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Menor % saída ÷ entrada — retém mais
                  </p>
                </div>
                {maquinas.menosPaga.length === 0 ? (
                  <p className="py-8 text-[15px] text-slate-500">
                    Precisa de pelo menos 2 máquinas com % pago.
                  </p>
                ) : (
                  maquinas.menosPaga.map((m, i) => (
                    <MaquinaRankRow
                      key={`menos-pago-${m.equipamentoId}`}
                      maquina={m}
                      rank={i + 1}
                      variant="worst"
                      metric="pago"
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {aba === "sinais" && data.insights.length > 0 && (
          <section
            className="mt-10"
            style={{ animation: ativo ? "analiseRise 0.7s 0.34s ease-out both" : undefined }}
          >
            <p className="text-[12px] uppercase tracking-[0.22em] text-[#c4a574]/85">Sinais</p>
            <h2
              className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
            >
              O que merece atenção
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.insights.slice(0, 8).map((ins) => (
                <div
                  key={ins.id}
                  className="border border-white/[0.06] bg-white/[0.02] px-4 py-3.5"
                >
                  <p className="text-[14px] font-medium text-[#f4efe6]">{ins.titulo}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    {ins.descricao}
                  </p>
                  {ins.href && ins.hrefLabel && (
                    <Link
                      href={ins.href}
                      className="mt-2 inline-block text-[13px] text-[#c4a574] hover:underline"
                    >
                      {ins.hrefLabel} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {aba === "detalhe" && (
        <section
          ref={modulosRef}
          id="detalhe-nicho"
          className="mt-10 border-t border-white/[0.06] pt-10"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.22em] text-slate-500">
                {umNichoSo ? "Raio-X" : "Detalhamento"}
              </p>
              <h2
                className="mt-1.5 text-[1.65rem] tracking-tight text-[#f4efe6] sm:text-[2rem]"
                style={{ fontFamily: "var(--font-analise-display), Georgia, serif" }}
              >
                {umNichoSo ? "O que o ranking não mostra" : "Detalhe por nicho"}
              </h2>
              <p className="mt-1.5 max-w-lg text-[14px] text-slate-500">
                {umNichoSo
                  ? "Concentração, ticket por visita, máquinas que pagam alto e tipos de jogo — sem repetir a lista de cima."
                  : "Caixa, capital e alertas por módulo — sem repetir o ranking consolidado."}
              </p>
            </div>
          </div>
          <CentroInteligencia data={data} mode="modulos" periodo={periodo} />
        </section>
        )}
      </div>
    </div>
  );
}
