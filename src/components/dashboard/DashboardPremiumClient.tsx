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
import { DashboardBarChart7d } from "@/components/dashboard/DashboardBarChart7d";
import { DashboardMargemGauge } from "@/components/dashboard/DashboardMargemGauge";
import { PesquisaUpgradeBanner } from "@/components/onboarding/PesquisaUpgradeBanner";
import { TrialWelcomeGate } from "@/components/onboarding/TrialWelcomeGate";
import { PushAtivarBanner } from "@/components/configuracoes/PushAtivarBanner";
import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import { useAppTheme } from "@/components/layout/AppTheme";
import {
  analisePageBackground,
  appThemeToAnaliseVisual,
  periodoSelectorTema,
} from "@/lib/analise/analise-visual-theme";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TermoHint } from "@/components/ui/TermoHint";
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
  if (n > 0.009) return "text-at-money-pos";
  if (n < -0.009) return "text-at-money-neg";
  return "text-at-primary opacity-80";
}

function operacaoIniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function BankFlowCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof ArrowDownRight;
}) {
  return (
    <div className="rounded-2xl border border-at bg-at-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-at bg-at-card-soft text-at-accent">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-at-muted">
            {label}
          </p>
          <p className="mt-1 text-[1.35rem] font-medium tabular-nums leading-tight text-at-primary">
            {value}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-at-soft">{hint}</p>
        </div>
      </div>
    </div>
  );
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
    <div className="border border-at bg-at-card-soft px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2 border-b border-at-soft pb-3">
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "best" ? "text-at-money-pos opacity-80" : "text-at-money-neg opacity-80"
          )}
        />
        <h3 className="text-[13px] font-medium tracking-wide text-at-primary">{title}</h3>
        <span className="ml-auto text-[11px] tabular-nums text-at-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-sm text-at-muted">Sem dados no período.</p>
      ) : (
        <ul className="divide-y divide-[var(--at-border-soft)]">
          {items.map((item, i) => (
            <li key={item.pontoId}>
              <Link
                href={`/pontos/${item.pontoId}`}
                className="flex items-center gap-3 py-3 transition hover:bg-at-card-soft"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-semibold tabular-nums",
                    variant === "best" ? "text-at-link" : "text-at-money-neg opacity-80"
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-at-primary">
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
    <div className="bg-at-card px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">{kpi.label}</p>
      <p
        className={cn(
          "mt-1.5 text-[15px] font-medium tabular-nums",
          kpi.warning ? "text-at-link" : "text-at-primary"
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
  const { theme: appTheme } = useAppTheme();
  const visualTema = appThemeToAnaliseVisual(appTheme);
  const [ativo, setAtivo] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [performanceAberto, setPerformanceAberto] = useState(false);
  const [ritmoAberto, setRitmoAberto] = useState(false);
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
      data-analise-visual={visualTema}
      className={cn(
        display.variable,
        sans.variable,
        "premium-desk-root relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)]"
      )}
      style={{ fontFamily: "var(--font-dash-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: analisePageBackground(visualTema) }}
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

        {/* Header — estilo private banking */}
        <header
          className={cn("transition-opacity duration-700", ativo ? "opacity-100" : "opacity-0")}
          style={{ animation: ativo ? "dashRise 0.85s ease-out both" : undefined }}
        >
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-[clamp(1.85rem,5vw,2.75rem)] leading-[1.05] tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
            >
              {data.greeting}
            </h1>
            <div
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-at bg-at-card-soft text-[13px] tracking-[0.12em] text-at-muted"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
              aria-hidden
            >
              {operacaoIniciais(data.operacaoNome)}
            </div>
          </div>
          <p className="mt-2 text-[12px] text-at-muted">
            {data.operacaoNome}
            {data.nichoLabel ? ` · ${data.nichoLabel}` : ""}
          </p>
          <div className="mt-5">
            <PeriodoAnaliseSelector
              atual={periodo}
              basePath="/dashboard"
              variante="dashboard"
              tema={periodoSelectorTema(visualTema)}
            />
          </div>
        </header>

        {/* Hero — painel financeiro */}
        <section
          className="mt-8"
          style={{ animation: ativo ? "dashRise 0.7s 0.1s ease-out both" : undefined }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-at-muted">
            Lucro líquido · {data.periodLabel.toUpperCase()}
          </p>
          <p
            className={cn(
              "mt-2 text-[clamp(2.5rem,8vw,3.75rem)] font-normal leading-none tracking-tight tabular-nums",
              moneyTone(data.liquidoOperacao)
            )}
            style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
          >
            {formatCurrency(data.liquidoOperacao)}
          </p>
          <p className="mt-3 max-w-md text-[12px] leading-relaxed text-at-muted">
            Resultado da operação no período (conta na coleta, mesmo sem pagamento). O dinheiro
            que entrou de fato está em{" "}
            <Link href="/analise" className="text-at-link hover:underline">
              Análise
            </Link>
            .
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <BankFlowCard
              label="Entrada"
              value={formatCurrency(data.entrada)}
              hint="Máquinas faturaram"
              icon={ArrowDownRight}
            />
            <BankFlowCard
              label="Saída"
              value={formatCurrency(data.saida)}
              hint="Saiu das máquinas"
              icon={ArrowUpRight}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-6 border-t border-at-soft pt-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Movimento</p>
              <p className="mt-1 text-[1.35rem] font-medium tabular-nums text-at-primary">
                {formatCurrency(data.liquidoMovimento)}
              </p>
              <p className="mt-0.5 text-[11px] text-at-soft">(entrada − saída)</p>
            </div>
            {data.margemPct != null && <DashboardMargemGauge pct={data.margemPct} />}
          </div>

          {data.comparativo && (
            <p className="mt-4 text-[12px] text-at-muted">
              vs mês anterior:{" "}
              <span
                className={cn(
                  "tabular-nums font-medium",
                  data.comparativo.lucroAtual >= data.comparativo.lucroAnterior
                    ? "text-at-money-pos"
                    : "text-at-money-neg"
                )}
              >
                {data.comparativo.lucroAnterior > 0.009
                  ? `${(((data.comparativo.lucroAtual - data.comparativo.lucroAnterior) / Math.abs(data.comparativo.lucroAnterior)) * 100).toFixed(0)}%`
                  : formatCurrency(data.comparativo.lucroAtual - data.comparativo.lucroAnterior)}
              </span>
              {" · "}
              {data.comparativo.coletasAtual} coletas
            </p>
          )}

          {data.sparkline.length > 1 && (
            <div className="mt-8 rounded-2xl border border-at bg-at-card px-4 py-5 sm:px-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-at-muted">
                Últimos 7 dias
              </p>
              <div className="mt-3">
                <DashboardBarChart7d values={data.sparkline} tema={visualTema} />
              </div>
            </div>
          )}

          {/* Alertas operacionais */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link
              href="/coletas/pendentes"
              className="rounded-2xl border border-at bg-at-card px-4 py-4 transition hover:border-[var(--at-link)]/25"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">A receber</p>
              <p
                className={cn(                  "mt-1.5 text-[20px] font-medium tabular-nums text-at-primary"
                )}
              >
                {formatCurrency(data.aReceber)}
              </p>
              <p className="mt-1 text-[11px] text-at-soft">Valores em aberto</p>
            </Link>
            <Link
              href="/pontos"
              className="rounded-2xl border border-at bg-at-card px-4 py-4 transition hover:border-[var(--at-link)]/25"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Sem coleta</p>
              <p
                className={cn(                  "mt-1.5 text-[20px] font-medium tabular-nums text-at-primary"
                )}
              >
                {data.pontosSemColeta}
              </p>
              <p className="mt-1 text-[11px] text-at-soft">Mais de 7 dias parados</p>
            </Link>
            <Link
              href="/chamados"
              className="rounded-2xl border border-at bg-at-card px-4 py-4 transition hover:border-[var(--at-link)]/25"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Chamados</p>
              <p
                className={cn(                  "mt-1.5 text-[20px] font-medium tabular-nums text-at-primary"
                )}
              >
                {data.chamadosAbertos}
              </p>
              <p className="mt-1 text-[11px] text-at-soft">Manutenção aberta</p>
            </Link>
          </div>
        </section>

        {/* Briefing — prioridade máxima */}
        {briefing.length > 0 && (
          <section
            className="mt-10"
            style={{ animation: ativo ? "dashRise 0.7s 0.18s ease-out both" : undefined }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-at-accent">Agora</p>
            <h2
              className="mt-1.5 text-2xl tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
            >
              Precisa de você
            </h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {briefing.map((b) => (
                <Link
                  key={b.id}
                  href={b.href}
                  className="group flex items-start gap-3 border border-at bg-at-card-soft px-4 py-3.5 transition hover:border-[var(--at-link)]/25"
                >
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      b.tone === "danger"
                        ? "text-at-money-neg opacity-80"
                        : b.tone === "warning"
                          ? "text-at-link opacity-80"
                          : "text-at-link opacity-80"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-at-primary group-hover:text-at-link">
                      {b.titulo}
                    </p>
                    <p className="mt-0.5 text-[12px] text-at-muted">{b.descricao}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Detalhes financeiros — colapsável */}
        <CollapsibleSection
          label="Financeiro"
          title="Detalhes do período"
          subtitle="Entrada, saída, movimento e indicadores extras"
          aberto={detalhesAberto}
          onToggle={() => setDetalhesAberto((v) => !v)}
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-grid">
                <div className="bg-at-card px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Entrada</p>
                  <p className="mt-1.5 text-[18px] font-medium tabular-nums text-at-primary">
                    {formatCurrency(data.entrada)}
                  </p>
                  <p className="mt-1 text-[11px] text-at-soft">Máquinas faturaram</p>
                </div>
                <div className="bg-at-card px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Saída</p>
                  <p className="mt-1.5 text-[18px] font-medium tabular-nums text-at-primary">
                    {formatCurrency(data.saida)}
                  </p>
                  <p className="mt-1 text-[11px] text-at-soft">Saiu das máquinas</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-at-muted">
                <span className="inline-flex items-center gap-1.5">
                  {data.liquidoOperacao >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-at-money-pos opacity-80" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-at-money-neg opacity-80" />
                  )}
                  Movimento{" "}
                  <span className="tabular-nums text-at-primary">
                    {formatCurrency(data.liquidoMovimento)}
                  </span>
                </span>
                {data.margemPct != null && (
                  <span>
                    Margem{" "}
                    <span className="tabular-nums text-at-primary">{data.margemPct.toFixed(1)}%</span>
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-grid">
              <div className="bg-at-card px-4 py-3.5">
                <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-at-muted">
                  Haver
                  <TermoHint texto="Crédito que você deve ao ponto — saldo positivo a favor do cliente." />
                </p>
                <p className="mt-1.5 text-[15px] font-medium tabular-nums text-at-primary">
                  {formatCurrency(data.haver)}
                </p>
              </div>
              <div className="bg-at-card px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">A receber</p>
                <p className="mt-1.5 text-[15px] font-medium tabular-nums text-at-primary">
                  {formatCurrency(data.aReceber)}
                </p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-px bg-at-grid sm:grid-cols-4">
                {data.kpis.slice(0, 4).map((kpi) => (
                  <KpiCell key={kpi.label} kpi={kpi} />
                ))}
              </div>
              {data.comissaoStaff && data.comissaoStaff.linhas.length > 0 && (
                <div className="col-span-2 bg-at-card-soft px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                    {data.comissaoStaff.propria && data.comissaoStaff.linhas.length === 1
                      ? `Sua comissão (${data.comissaoStaff.linhas[0].percentual}%)`
                      : data.comissaoStaff.linhas.length === 1
                        ? `Comissão do ajudante (${data.comissaoStaff.linhas[0].percentual}%)`
                        : "Comissão do ajudante"}
                  </p>
                  <p className="mt-1.5 text-[15px] font-medium tabular-nums text-at-primary">
                    {formatCurrency(
                      data.comissaoStaff.linhas.length === 1
                        ? data.comissaoStaff.linhas[0].aPagar
                        : data.comissaoStaff.totalAPagar
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* Nichos (multi) */}
        {data.isMulti && data.nichos.length > 0 && (
          <section
            className="mt-14"
            style={{ animation: ativo ? "dashRise 0.7s 0.24s ease-out both" : undefined }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-at-accent">
              Atribuição
            </p>
            <h2
              className="mt-1.5 text-2xl tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-dash-display), Georgia, serif" }}
            >
              Por nicho
            </h2>
            <div className="mt-6 space-y-1 border-t border-at pt-1">
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
                      "w-full border-b border-at-soft py-3.5 text-left transition last:border-0",
                      selected && "bg-at-card-soft"
                    )}
                    style={{
                      animation: ativo
                        ? `dashRise 0.5s ${0.04 * i}s ease-out both`
                        : undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-medium text-at-primary">
                          {NICHO_LABELS[n.id] ?? n.label}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-at-muted">
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
                    <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-at-track">
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
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-grid sm:grid-cols-3 lg:grid-cols-6">
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">
                    Lucro líquido
                  </p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.liquidoOperacao)}
                  </p>
                </div>
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">Entrada</p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.entrada)}
                  </p>
                </div>
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">Saída</p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.saida)}
                  </p>
                </div>
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">Movimento</p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.liquidoMovimento)}
                  </p>
                </div>
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">A receber</p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.aReceber)}
                  </p>
                </div>
                <div className="bg-at-card px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-at-muted">Haver</p>
                  <p className="mt-1 text-[13px] tabular-nums text-at-primary">
                    {formatCurrency(nichoDetalhe.haver)}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Performance — colapsável */}
        <CollapsibleSection
          label="Performance"
          title="Quem puxa · quem sangra"
          subtitle={`Fortes ${data.saude.contagem.forte} · Fracos ${data.saude.contagem.fraco} · Melhor: ${data.melhores[0]?.nome ?? "—"}`}
          aberto={performanceAberto}
          onToggle={() => setPerformanceAberto((v) => !v)}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3 text-[12px]">
              <span className="border border-at px-3 py-1.5 text-at-muted">
                Fortes{" "}
                <strong className="tabular-nums text-at-primary">
                  {data.saude.contagem.forte}
                </strong>
                <TermoHint
                  className="ml-1"
                  texto="Pontos no top do lucro no período — acima da mediana da frota."
                />
              </span>
              <span className="border border-at px-3 py-1.5 text-at-muted">
                Razoáveis{" "}
                <strong className="tabular-nums text-at-primary">
                  {data.saude.contagem.razoavel}
                </strong>
              </span>
              <span className="border border-at px-3 py-1.5 text-at-muted">
                Fracos{" "}
                <strong className="tabular-nums text-at-primary">
                  {data.saude.contagem.fraco}
                </strong>
              </span>
              {data.saude.contagem.semDados > 0 && (
                <span className="border border-at px-3 py-1.5 text-at-muted">
                  Sem leitura{" "}
                  <strong className="tabular-nums text-at-muted">
                    {data.saude.contagem.semDados}
                  </strong>
                </span>
              )}
            </div>
            <Link
              href="/analise"
              className="text-[12px] text-at-link transition hover:underline"
            >
              Análise completa →
            </Link>
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
        </CollapsibleSection>

        {/* Ritmo — colapsável */}
        <CollapsibleSection
          label="Ritmo"
          title="Pulso e cartela"
          subtitle="Impulsos vs pressões e movimento da base de pontos"
          aberto={ritmoAberto}
          onToggle={() => setRitmoAberto((v) => !v)}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-at bg-at-card-soft px-5 py-5">
              <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-at-muted">
                Pulso
                <TermoHint texto="Índice de impulsos (coletas positivas) vs pressões (negativos) no período." />
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-at-muted">
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
                    <p className="text-[10px] uppercase tracking-wider text-at-soft">{label}</p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-medium tabular-nums",
                        bloco.indice == null
                          ? "text-at-soft"
                          : bloco.indice >= 65
                            ? "text-at-money-pos"
                            : bloco.indice >= 45
                              ? "text-at-link"
                              : "text-at-money-neg"
                      )}
                    >
                      {bloco.indice != null ? `${bloco.indice.toFixed(0)}%` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-at bg-at-card-soft px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-at-muted">Base</p>
              <p className="mt-2 text-[13px] text-at-muted">Cartela de pontos no mês</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-at-soft">Captados</p>
                  <p className="mt-1 text-2xl tabular-nums text-at-primary">
                    {data.cartela.mes.captados.length}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-at-soft">Encerrados</p>
                  <p className="mt-1 text-2xl tabular-nums text-at-primary">
                    {data.cartela.mes.encerrados.length}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12px] tabular-nums text-at-muted">
                Base ativa: {data.cartela.ativosAgora}
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Actions */}
        <section
          className="mt-14 border-t border-at pt-8"
          style={{ animation: ativo ? "dashRise 0.7s 0.4s ease-out both" : undefined }}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-at-muted">Ir trabalhar</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {primary && (
              <Link
                href={primary.href}
                className="inline-flex items-center gap-2 rounded-sm border border-[var(--at-link)]/40 bg-[var(--at-tab-active-bg)] px-5 py-2.5 text-[13px] font-medium text-at-link transition hover:border-[var(--at-link)]/55"
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
                  className="inline-flex items-center gap-2 rounded-sm border border-at px-4 py-2.5 text-[13px] text-at-muted transition hover:border-[var(--at-link)]/30 hover:text-at-primary"
                >
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {action.label}
                </Link>
              );
            })}
            <Link
              href="/analise"
              className="inline-flex items-center gap-2 rounded-sm border border-at px-4 py-2.5 text-[13px] text-at-muted transition hover:border-[var(--at-link)]/30 hover:text-at-link"
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
