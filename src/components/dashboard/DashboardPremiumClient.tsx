"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ClipboardCheck,
  MapPin,
  Package,
  Route,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { mensagemPulso } from "@/lib/dashboard-pulso";
import { DashboardSparkline } from "@/components/dashboard/DashboardSparkline";
import { PesquisaUpgradeBanner } from "@/components/onboarding/PesquisaUpgradeBanner";
import { TrialWelcomeGate } from "@/components/onboarding/TrialWelcomeGate";
import { PushAtivarBanner } from "@/components/configuracoes/PushAtivarBanner";
import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";
import type {
  DashboardKpi,
  DashboardPremiumData,
  DashboardRankItem,
} from "@/components/dashboard/dashboard-premium-types";
import type { TrialResumo } from "@/lib/onboarding/trial-resumo";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dash-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-dash-sans",
});

const ACCENT = "#c4a574";

const NICHO_LABELS: Record<DashboardNichoId, string> = {
  maquinas_cassino: "Cassino",
  fura_fura: "Fura Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

const iconMap: Record<string, LucideIcon> = {
  Package,
  MapPin,
  Route,
  Activity,
  Wallet,
  ClipboardCheck,
  UserPlus,
  BarChart3,
  AlertTriangle,
};

function moneyTone(n: number) {
  if (n > 0.009) return "text-emerald-400/95";
  if (n < -0.009) return "text-rose-400/95";
  return "text-[#f4efe6]/85";
}

function RankCol({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: typeof TrendingUp;
  items: DashboardRankItem[];
  variant: "best" | "worst";
}) {
  return (
    <div className="border border-white/[0.06] bg-white/[0.015] px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3">
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "best" ? "text-emerald-400/80" : "text-rose-400/80"
          )}
        />
        <h3 className="text-[13px] font-medium tracking-wide text-[#f4efe6]">{title}</h3>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-sm text-slate-500">Sem dados no período.</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {items.map((item, i) => (
            <li key={item.pontoId}>
              <Link
                href={`/pontos/${item.pontoId}`}
                className="flex items-center gap-3 py-3 transition hover:bg-white/[0.02]"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-semibold tabular-nums",
                    variant === "best" ? "text-[#c4a574]" : "text-rose-300/80"
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#f4efe6]">
                  {item.nome}
                </span>
                <span className={cn("shrink-0 text-[13px] font-medium tabular-nums", moneyTone(item.valor))}>
                  {formatCurrency(item.valor)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiCell({ kpi }: { kpi: DashboardKpi }) {
  return (
    <div className="bg-[#0a0e16]/95 px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
      <p
        className={cn(
          "mt-1.5 text-[15px] font-medium tabular-nums",
          kpi.warning ? "text-amber-300/90" : "text-[#f4efe6]"
        )}
      >
        {kpi.isCurrency ? formatCurrency(kpi.value) : kpi.value}
      </p>
    </div>
  );
}

export function DashboardPremiumClient({
  data,
  periodo,
  trialResumo = null,
}: {
  data: DashboardPremiumData;
  periodo: PeriodoAnaliseRange;
  trialResumo?: TrialResumo | null;
}) {
  const [ativo, setAtivo] = useState(false);
  const [nichoAtivo, setNichoAtivo] = useState<DashboardNichoId | null>(
    data.nichos[0]?.id ?? null
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (data.nichos.length && !data.nichos.some((n) => n.id === nichoAtivo)) {
      setNichoAtivo(data.nichos[0]?.id ?? null);
    }
  }, [data.nichos, nichoAtivo]);

  const maxAbsNicho = useMemo(
    () => Math.max(0, ...data.nichos.map((n) => Math.abs(n.lucro))),
    [data.nichos]
  );

  const nichoDetalhe = data.nichos.find((n) => n.id === nichoAtivo);

  const briefing = useMemo(() => {
    const items: {
      id: string;
      titulo: string;
      descricao: string;
      href: string;
      tone: "danger" | "warning" | "info";
    }[] = [];

    if (data.chamadosAbertos > 0) {
      items.push({
        id: "chamados",
        titulo: `${data.chamadosAbertos} chamado${data.chamadosAbertos === 1 ? "" : "s"} aberto${data.chamadosAbertos === 1 ? "" : "s"}`,
        descricao: "Manutenção ou atendimento pendente",
        href: "/chamados",
        tone: "danger",
      });
    }
    if (data.pontosSemColeta > 0) {
      items.push({
        id: "sem-coleta",
        titulo: `${data.pontosSemColeta} ponto${data.pontosSemColeta === 1 ? "" : "s"} sem coleta`,
        descricao: "Mais de 7 dias sem visita",
        href: "/pontos",
        tone: "warning",
      });
    }
    const pior = data.piores[0];
    if (pior && pior.valor < -0.009) {
      items.push({
        id: "pior",
        titulo: `Pressão em ${pior.nome}`,
        descricao: `${formatCurrency(pior.valor)} no mês`,
        href: `/pontos/${pior.pontoId}`,
        tone: "danger",
      });
    }
    if (data.aReceber > 0.009) {
      items.push({
        id: "receber",
        titulo: `A receber ${formatCurrency(data.aReceber)}`,
        descricao: "Valores em aberto nas coletas",
        href: "/coletas/pendentes",
        tone: "info",
      });
    }
    return items.slice(0, 4);
  }, [data]);

  const [primary, ...secondary] = data.quickActions;

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)]"
      )}
      style={{ fontFamily: "var(--font-dash-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 50% at 50% -8%, rgba(196,165,116,0.14), transparent 55%), radial-gradient(ellipse 45% 35% at 95% 20%, rgba(16,185,129,0.04), transparent 50%), radial-gradient(ellipse 40% 30% at 5% 75%, rgba(120,90,50,0.1), transparent 45%), linear-gradient(180deg, #06080e 0%, #0a0e16 50%, #07090f 100%)",
          }}
        />
      </div>

      <style>{`
        @keyframes dashRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dashLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        {trialResumo && <TrialWelcomeGate resumo={trialResumo} />}
        <div className="mb-6">
          <PushAtivarBanner />
        </div>
        {data.pesquisaUpgrade && (
          <div
            className={cn(
              "mb-6 transition-opacity duration-700",
              ativo ? "opacity-100" : "opacity-0"
            )}
            style={{ animation: ativo ? "dashRise 0.85s ease-out both" : undefined }}
          >
            <PesquisaUpgradeBanner insight={data.pesquisaUpgrade} />
          </div>
        )}

        {/* Header */}
        <header
          className={cn("transition-opacity duration-700", ativo ? "opacity-100" : "opacity-0")}
          style={{ animation: ativo ? "dashRise 0.85s ease-out both" : undefined }}
        >
          <p
            className="text-[11px] font-medium uppercase text-[#c4a574]/90"
            style={{ letterSpacing: "0.38em" }}
          >
            {data.greeting}
          </p>
          <h1
            className="mt-3 text-[clamp(2.2rem,5.5vw,3.5rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
            style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
          >
            {data.operacaoNome}
          </h1>
          <p className="mt-3 text-[13px] text-slate-400">
            {data.nichoLabel}
            {data.movimentosLabel ? (
              <>
                {" "}
                · <span className="text-slate-500">{data.movimentosLabel}</span>
              </>
            ) : null}
            <span className="text-slate-600"> · </span>
            <span className="uppercase tracking-[0.12em] text-slate-500">{data.periodLabel}</span>
          </p>
          <div className="mt-5">
            <PeriodoAnaliseSelector
              atual={periodo}
              basePath="/dashboard"
              variante="dashboard"
            />
          </div>
          <div
            className="mt-8 h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/60 via-white/10 to-transparent"
            style={{ animation: ativo ? "dashLine 1s 0.2s ease-out both" : undefined }}
          />
        </header>

        {/* Hero */}
        <section
          className="mt-10"
          style={{ animation: ativo ? "dashRise 0.7s 0.1s ease-out both" : undefined }}
        >
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Lucro líquido · {data.periodLabel}
              </p>
              <p
                className={cn(
                  "mt-2 text-[clamp(2.6rem,6vw,3.8rem)] font-normal leading-none tracking-tight tabular-nums",
                  moneyTone(data.liquidoOperacao)
                )}
                style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
              >
                {formatCurrency(data.liquidoOperacao)}
              </p>
              <p className="mt-2 max-w-md text-[12px] leading-relaxed text-slate-500">
                Resultado da operação no período (conta na coleta, mesmo sem pagamento).
                O dinheiro que entrou de fato está em Análise.
              </p>

              <div className="mt-6 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06]">
                <div className="bg-[#0a0e16]/95 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Entrada
                  </p>
                  <p className="mt-1.5 text-[18px] font-medium tabular-nums text-emerald-400/90">
                    {formatCurrency(data.entrada)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">Máquinas faturaram</p>
                </div>
                <div className="bg-[#0a0e16]/95 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Saída
                  </p>
                  <p className="mt-1.5 text-[18px] font-medium tabular-nums text-rose-400/90">
                    {formatCurrency(data.saida)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">Saiu das máquinas</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  {data.liquidoOperacao >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400/80" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-400/80" />
                  )}
                  Movimento{" "}
                  <span className="tabular-nums text-[#f4efe6]">
                    {formatCurrency(data.liquidoMovimento)}
                  </span>
                  <span className="text-slate-600">(entrada − saída)</span>
                </span>
                {data.margemPct != null && (
                  <span>
                    Margem{" "}
                    <span className="tabular-nums text-[#f4efe6]">{data.margemPct.toFixed(1)}%</span>
                  </span>
                )}
              </div>
              {data.sparkline.length > 1 && (
                <div className="mt-7 max-w-sm">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#c4a574]/70">
                    Últimos 7 dias
                  </p>
                  <div className="rounded-sm border border-[#c4a574]/12 bg-gradient-to-b from-[#c4a574]/[0.06] to-transparent px-3 py-3">
                    <DashboardSparkline values={data.sparkline} size="lg" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06]">
              <div className="bg-[#0a0e16]/95 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">A receber</p>
                <p className="mt-1.5 text-[15px] font-medium tabular-nums text-[#f4efe6]">
                  {formatCurrency(data.aReceber)}
                </p>
              </div>
              <div className="bg-[#0a0e16]/95 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Haver</p>
                <p className="mt-1.5 text-[15px] font-medium tabular-nums text-[#f4efe6]">
                  {formatCurrency(data.haver)}
                </p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-4">
                {data.kpis.slice(0, 4).map((kpi) => (
                  <KpiCell key={kpi.label} kpi={kpi} />
                ))}
              </div>
            </div>
          </div>

          {data.comparativo && (
            <p className="mt-5 text-[12px] text-slate-500">
              vs mês anterior:{" "}
              <span
                className={cn(
                  "tabular-nums font-medium",
                  data.comparativo.lucroAtual >= data.comparativo.lucroAnterior
                    ? "text-emerald-400/90"
                    : "text-rose-400/90"
                )}
              >
                {data.comparativo.lucroAnterior > 0.009
                  ? `${(((data.comparativo.lucroAtual - data.comparativo.lucroAnterior) / Math.abs(data.comparativo.lucroAnterior)) * 100).toFixed(0)}%`
                  : formatCurrency(data.comparativo.lucroAtual - data.comparativo.lucroAnterior)}
              </span>
              {" · "}
              {data.comparativo.coletasAtual} coletas este mês
              {data.comparativo.coletasAnterior > 0
                ? ` (${data.comparativo.coletasAnterior} no anterior)`
                : ""}
            </p>
          )}
        </section>

        {/* Briefing */}
        {briefing.length > 0 && (
          <section
            className="mt-12"
            style={{ animation: ativo ? "dashRise 0.7s 0.18s ease-out both" : undefined }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a574]/85">Agora</p>
            <h2
              className="mt-1.5 text-2xl tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
            >
              O que precisa de você
            </h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {briefing.map((b) => (
                <Link
                  key={b.id}
                  href={b.href}
                  className="group flex items-start gap-3 border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition hover:border-[#c4a574]/25"
                >
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      b.tone === "danger"
                        ? "text-rose-400/80"
                        : b.tone === "warning"
                          ? "text-amber-400/80"
                          : "text-[#c4a574]/80"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#f4efe6] group-hover:text-white">
                      {b.titulo}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">{b.descricao}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Nichos (multi) */}
        {data.isMulti && data.nichos.length > 0 && (
          <section
            className="mt-14"
            style={{ animation: ativo ? "dashRise 0.7s 0.24s ease-out both" : undefined }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a574]/85">
              Atribuição
            </p>
            <h2
              className="mt-1.5 text-2xl tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
            >
              Por nicho
            </h2>
            <div className="mt-6 space-y-1 border-t border-white/[0.06] pt-1">
              {data.nichos.map((n, i) => {
                const width =
                  maxAbsNicho > 0
                    ? Math.max(4, Math.min(100, (Math.abs(n.lucro) / maxAbsNicho) * 100))
                    : 4;
                const selected = nichoAtivo === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNichoAtivo(n.id)}
                    className={cn(
                      "w-full border-b border-white/[0.04] py-3.5 text-left transition last:border-0",
                      selected && "bg-white/[0.02]"
                    )}
                    style={{
                      animation: ativo
                        ? `dashRise 0.5s ${0.04 * i}s ease-out both`
                        : undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-medium text-[#f4efe6]">
                          {NICHO_LABELS[n.id] ?? n.label}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                          {n.movimentos} mov.
                          {n.shareLucroPct != null
                            ? ` · ${n.shareLucroPct.toFixed(1)}% da operação`
                            : ""}
                        </p>
                      </div>
                      <p className={cn("text-sm font-semibold tabular-nums", moneyTone(n.lucro))}>
                        {formatCurrency(n.lucro)}
                      </p>
                    </div>
                    <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background:
                            n.lucro >= 0
                              ? `linear-gradient(90deg, ${ACCENT}66, ${ACCENT})`
                              : "linear-gradient(90deg, rgba(251,113,133,0.35), rgba(251,113,133,0.85))",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            {nichoDetalhe && (
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Lucro líquido
                  </p>
                  <p className="mt-1 text-[13px] tabular-nums text-[#f4efe6]">
                    {formatCurrency(nichoDetalhe.liquidoOperacao)}
                  </p>
                </div>
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Entrada</p>
                  <p className="mt-1 text-[13px] tabular-nums text-emerald-400/90">
                    {formatCurrency(nichoDetalhe.entrada)}
                  </p>
                </div>
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Saída</p>
                  <p className="mt-1 text-[13px] tabular-nums text-rose-400/90">
                    {formatCurrency(nichoDetalhe.saida)}
                  </p>
                </div>
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Movimento</p>
                  <p className="mt-1 text-[13px] tabular-nums text-[#f4efe6]">
                    {formatCurrency(nichoDetalhe.liquidoMovimento)}
                  </p>
                </div>
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">A receber</p>
                  <p className="mt-1 text-[13px] tabular-nums text-[#f4efe6]">
                    {formatCurrency(nichoDetalhe.aReceber)}
                  </p>
                </div>
                <div className="bg-[#0a0e16]/95 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Haver</p>
                  <p className="mt-1 text-[13px] tabular-nums text-[#f4efe6]">
                    {formatCurrency(nichoDetalhe.haver)}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Triage */}
        <section
          className="mt-14"
          style={{ animation: ativo ? "dashRise 0.7s 0.3s ease-out both" : undefined }}
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a574]/85">
                Performance
              </p>
              <h2
                className="mt-1.5 text-2xl tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
              >
                Quem puxa · quem sangra
              </h2>
            </div>
            <Link
              href="/analise"
              className="text-[12px] text-[#c4a574] transition hover:underline"
            >
              Análise completa →
            </Link>
          </div>

          <div className="mb-5 flex flex-wrap gap-3 text-[12px]">
            <span className="border border-white/[0.06] px-3 py-1.5 text-slate-400">
              Fortes{" "}
              <strong className="tabular-nums text-emerald-400/90">
                {data.saude.contagem.forte}
              </strong>
            </span>
            <span className="border border-white/[0.06] px-3 py-1.5 text-slate-400">
              Razoáveis{" "}
              <strong className="tabular-nums text-[#f4efe6]">
                {data.saude.contagem.razoavel}
              </strong>
            </span>
            <span className="border border-white/[0.06] px-3 py-1.5 text-slate-400">
              Fracos{" "}
              <strong className="tabular-nums text-rose-400/90">
                {data.saude.contagem.fraco}
              </strong>
            </span>
            {data.saude.contagem.semDados > 0 && (
              <span className="border border-white/[0.06] px-3 py-1.5 text-slate-500">
                Sem leitura{" "}
                <strong className="tabular-nums text-slate-400">
                  {data.saude.contagem.semDados}
                </strong>
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RankCol title="Melhores" icon={TrendingUp} items={data.melhores} variant="best" />
            <RankCol
              title={data.piores.some((p) => p.valor < -0.009) ? "Piores" : "Menor rendimento"}
              icon={TrendingDown}
              items={data.piores}
              variant="worst"
            />
          </div>
        </section>

        {/* Ritmo */}
        <section
          className="mt-14 grid gap-6 lg:grid-cols-2"
          style={{ animation: ativo ? "dashRise 0.7s 0.36s ease-out both" : undefined }}
        >
          <div className="border border-white/[0.06] bg-white/[0.015] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pulso</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
              {mensagemPulso(data.pulso)}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {(
                [
                  ["Semana", data.pulso.semana],
                  ["Mês", data.pulso.mes],
                  ["Sem. ant.", data.pulso.semanaAnterior],
                ] as const
              ).map(([label, bloco]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-medium tabular-nums",
                      bloco.indice == null
                        ? "text-slate-600"
                        : bloco.indice >= 65
                          ? "text-emerald-400/90"
                          : bloco.indice >= 45
                            ? "text-amber-300/90"
                            : "text-rose-400/90"
                    )}
                  >
                    {bloco.indice != null ? `${bloco.indice.toFixed(0)}%` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/[0.06] bg-white/[0.015] px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Base</p>
            <p className="mt-2 text-[13px] text-slate-400">Cartela de pontos no mês</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Captados</p>
                <p className="mt-1 text-2xl tabular-nums text-[#f4efe6]">
                  {data.cartela.mes.captados.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Encerrados</p>
                <p className="mt-1 text-2xl tabular-nums text-[#f4efe6]">
                  {data.cartela.mes.encerrados.length}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12px] tabular-nums text-slate-500">
              Base ativa: {data.cartela.ativosAgora}
            </p>
          </div>
        </section>

        {/* Actions */}
        <section
          className="mt-14 border-t border-white/[0.06] pt-8"
          style={{ animation: ativo ? "dashRise 0.7s 0.4s ease-out both" : undefined }}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Ir trabalhar</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {primary && (
              <Link
                href={primary.href}
                className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-5 py-2.5 text-[13px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/22"
              >
                {(() => {
                  const Icon = iconMap[primary.icon ?? "Package"] ?? Package;
                  return <Icon className="h-4 w-4" />;
                })()}
                {primary.label}
              </Link>
            )}
            {secondary.map((action) => {
              const Icon = iconMap[action.icon ?? "Package"] ?? Package;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="inline-flex items-center gap-2 rounded-sm border border-white/[0.08] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-white/15 hover:text-[#f4efe6]"
                >
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {action.label}
                </Link>
              );
            })}
            <Link
              href="/analise"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.08] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-[#c4a574]/30 hover:text-[#c4a574]"
            >
              <BarChart3 className="h-3.5 w-3.5 opacity-70" />
              Análise
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
