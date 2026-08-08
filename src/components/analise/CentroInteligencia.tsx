"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Box,
  CircleDot,
  Coins,
  Gamepad2,
  Gift,
  Joystick,
  Lightbulb,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { SaudePontosPainel } from "@/components/analise/SaudePontosPainel";
import { FuraFuraCaixaPainel } from "@/components/analise/FuraFuraCaixaPainel";
import { InteligenciaIAPainel } from "@/components/analise/InteligenciaIAPainel";
import type {
  InteligenciaOperacional,
  InsightOperacional,
  NichoColetaAnalise,
} from "@/lib/analise/inteligencia-operacional";

type SecaoId =
  | "geral"
  | "fura"
  | "ursinho"
  | "cassino"
  | "diversao"
  | "bolinha"
  | "consignado"
  | "capital"
  | "alertas"
  | "ia";

const SECOES: { id: SecaoId; label: string; icon: typeof BarChart3 }[] = [
  { id: "geral", label: "Visão geral", icon: Sparkles },
  { id: "fura", label: "Fura Fura", icon: Gift },
  { id: "ursinho", label: "Ursinho", icon: Box },
  { id: "cassino", label: "Cassino", icon: Gamepad2 },
  { id: "diversao", label: "Diversão", icon: Joystick },
  { id: "bolinha", label: "Bolinha", icon: CircleDot },
  { id: "consignado", label: "Consignado", icon: ShoppingBag },
  { id: "capital", label: "Capital", icon: Package },
  { id: "alertas", label: "Alertas", icon: Lightbulb },
  { id: "ia", label: "Análise Inteligente", icon: Sparkles },
];

function KpiCard({
  label,
  value,
  sub,
  accent = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "green" | "red" | "cyan" | "amber";
  icon?: typeof Coins;
}) {
  const accents = {
    default: "border-white/[0.06] bg-white/[0.02]",
    green: "border-green-500/20 bg-green-500/[0.04]",
    red: "border-red-500/20 bg-red-500/[0.04]",
    cyan: "border-cyan-500/20 bg-cyan-500/[0.04]",
    amber: "border-amber-500/20 bg-amber-500/[0.04]",
  };
  return (
    <div className={cn("rounded-xl border p-4", accents[accent])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-600" />}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function RankingRow({
  pos,
  titulo,
  subtitulo,
  valor,
  valorNegativo,
  href,
}: {
  pos: number;
  titulo: string;
  subtitulo?: string;
  valor: string;
  valorNegativo?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 transition hover:border-primary-neon/20 hover:bg-white/[0.04]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-xs font-medium text-slate-400">
        {pos}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{titulo}</p>
        {subtitulo && <p className="truncate text-xs text-slate-500">{subtitulo}</p>}
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          valorNegativo ? "text-red-400" : "text-green-400"
        )}
      >
        {valor}
      </span>
    </div>
  );
  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function InsightCard({ insight }: { insight: InsightOperacional }) {
  const styles = {
    success: "border-green-500/25 bg-green-500/[0.05]",
    danger: "border-red-500/25 bg-red-500/[0.05]",
    warning: "border-amber-500/25 bg-amber-500/[0.05]",
    info: "border-cyan-500/25 bg-cyan-500/[0.05]",
  };
  const icons = {
    success: TrendingUp,
    danger: TrendingDown,
    warning: AlertTriangle,
    info: Lightbulb,
  };
  const Icon = icons[insight.severidade];
  return (
    <div className={cn("rounded-xl border p-4", styles[insight.severidade])}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{insight.titulo}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{insight.descricao}</p>
          {insight.href && insight.hrefLabel && (
            <Link
              href={insight.href}
              className="mt-2 inline-flex text-xs text-primary-neon hover:underline"
            >
              {insight.hrefLabel} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SecaoTitulo({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
    </div>
  );
}

function NichoColetaPainel({
  bloco,
  periodoLabel,
  tituloCaixa,
  descricaoCaixa,
  labelItens = "Brindes / itens",
  showBrindes = true,
}: {
  bloco: NichoColetaAnalise;
  periodoLabel: string;
  tituloCaixa: string;
  descricaoCaixa: string;
  labelItens?: string;
  showBrindes?: boolean;
}) {
  const subPeriodo = periodoLabel.toLowerCase();
  return (
    <div className="space-y-8">
      <FuraFuraCaixaPainel
        caixa={{
          ...bloco.caixa,
          haver: 0,
        }}
        periodoLabel={periodoLabel}
        titulo={tituloCaixa}
        descricao={descricaoCaixa}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Lucro livre"
          value={formatCurrency(bloco.caixa.lucroLivre)}
          accent={bloco.caixa.lucroLivre >= 0 ? "green" : "red"}
        />
        <KpiCard label="Coletas" value={String(bloco.coletas)} sub={subPeriodo} />
        <KpiCard
          label="Equipamentos"
          value={String(bloco.totalMaquinas)}
          sub="ativos nos pontos"
        />
        {showBrindes ? (
          <KpiCard
            label={`Custo ${labelItens.toLowerCase()}`}
            value={formatCurrency(bloco.caixa.reservaBrindes)}
            accent="amber"
          />
        ) : (
          <KpiCard
            label="Recebido"
            value={formatCurrency(bloco.caixa.recebido)}
            sub={`Pendente ${formatCurrency(bloco.caixa.pendenteReceber)}`}
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <SecaoTitulo titulo="Pontos — melhor lucro" descricao={`Ranking · ${periodoLabel}`} />
          <div className="space-y-2">
            {bloco.rankingPontos.slice(0, 8).map((p, i) => (
              <RankingRow
                key={p.pontoId}
                pos={i + 1}
                titulo={p.nome}
                subtitulo={`${p.movimentos} coleta(s)${p.cidade ? ` · ${p.cidade}` : ""}${
                  p.custoBrindes > 0 ? ` · custo ${formatCurrency(p.custoBrindes)}` : ""
                }`}
                valor={formatCurrency(p.lucro)}
                valorNegativo={p.lucro < 0}
                href={`/pontos/${p.pontoId}`}
              />
            ))}
            {bloco.rankingPontos.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma coleta no período.</p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <SecaoTitulo titulo="Pontos — mais pressão" descricao={`Menor lucro · ${periodoLabel}`} />
          <div className="space-y-2">
            {[...bloco.rankingPontos]
              .sort((a, b) => a.lucro - b.lucro)
              .slice(0, 8)
              .map((p, i) => (
                <RankingRow
                  key={p.pontoId}
                  pos={i + 1}
                  titulo={p.nome}
                  subtitulo={`${p.movimentos} coleta(s)`}
                  valor={formatCurrency(p.lucro)}
                  valorNegativo={p.lucro < 0}
                  href={`/pontos/${p.pontoId}`}
                />
              ))}
          </div>
        </div>
      </div>

      {bloco.rankingMaquinas.length > 0 && (
        <div className="space-y-3">
          <SecaoTitulo
            titulo="Equipamentos com mais potencial"
            descricao="Lucro e volume no período"
          />
          <div className="space-y-2">
            {bloco.rankingMaquinas.slice(0, 8).map((m, i) => (
              <RankingRow
                key={m.equipamentoId}
                pos={i + 1}
                titulo={m.nome}
                subtitulo={`${m.pontoNome}${m.numeroMaquina ? ` · #${m.numeroMaquina}` : ""} · ${m.leituras} coleta(s)`}
                valor={formatCurrency(m.lucro)}
                valorNegativo={m.lucro < 0}
                href={m.pontoId ? `/pontos/${m.pontoId}` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {showBrindes && (
        <div className="space-y-3">
          <SecaoTitulo titulo={labelItens} descricao="O que mais saiu no período" />
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Entregues</th>
                  <th className="px-4 py-3 font-medium">Custo</th>
                  <th className="px-4 py-3 font-medium">Coletas</th>
                </tr>
              </thead>
              <tbody>
                {bloco.rankingBrindes.map((b) => (
                  <tr key={b.nome} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 font-medium text-white">{b.nome}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{b.entregues}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-400">
                      {formatCurrency(b.custoTotal)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      {b.coletasComEntrega}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bloco.rankingBrindes.length === 0 && (
              <p className="p-4 text-sm text-slate-500">Sem dados no período.</p>
            )}
          </div>
        </div>
      )}

      {bloco.saudePontos.length > 0 && <SaudePontosPainel itens={bloco.saudePontos} />}
    </div>
  );
}

export function CentroInteligencia({
  data,
  mode = "full",
}: {
  data: InteligenciaOperacional;
  /** full = hero + visão geral; modulos = só abas de nicho/capital/alertas/ia */
  mode?: "full" | "modulos";
}) {
  const secoesVisiveis = SECOES.filter((s) => {
    if (mode === "modulos" && s.id === "geral") return false;
    if (s.id === "fura") return data.nichos.furaFura;
    if (s.id === "ursinho") return data.nichos.ursinho;
    if (s.id === "cassino") return data.nichos.cassino;
    if (s.id === "diversao") return data.nichos.diversao;
    if (s.id === "bolinha") return data.nichos.bolinha;
    if (s.id === "consignado") return data.nichos.consignado;
    return true;
  });

  const [secao, setSecao] = useState<SecaoId>(
    mode === "modulos" ? (secoesVisiveis[0]?.id ?? "capital") : "geral"
  );
  const v = data.visaoGeral;
  const subPeriodo = data.periodoLabel.toLowerCase();

  return (
    <div className="space-y-6">
      {mode === "full" && (
      <div className="relative overflow-hidden rounded-2xl border border-primary-neon/15 bg-gradient-to-br from-primary-neon/[0.08] via-transparent to-transparent p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-neon/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Centro de inteligência · {data.periodoLabel}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-sm text-slate-400">Lucro líquido · {data.periodoLabel}</p>
              <p
                className={cn(
                  "text-4xl font-bold tabular-nums tracking-tight",
                  (v.liquidoOperacao ?? v.lucroLiquido) >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {formatCurrency(v.liquidoOperacao ?? v.lucroLiquido)}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span>
                Entrada{" "}
                <strong className="text-white">
                  {formatCurrency(v.entrada ?? v.faturamentoBruto)}
                </strong>
              </span>
              <span>
                Saída <strong className="text-white">{formatCurrency(v.saida ?? 0)}</strong>
              </span>
              <span>
                Comissão <strong className="text-white">{formatCurrency(v.comissao ?? 0)}</strong>
              </span>
              {v.margemPct != null && (
                <span>
                  Margem <strong className="text-white">{v.margemPct.toFixed(1)}%</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Navegação por seções */}
      <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {secoesVisiveis.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSecao(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              secao === id
                ? id === "ia"
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  : "border-primary-neon/40 bg-primary-neon/10 text-primary-neon"
                : id === "ia"
                  ? "border-purple-500/20 bg-purple-500/[0.04] text-purple-400/80 hover:text-purple-300"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white"
            )}
          >
            {id === "ia" ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/20">
                <Sparkles className="h-3 w-3 text-purple-400" />
              </span>
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
            {id === "alertas" &&
              (data.insights.length > 0 || data.estoque.alertasPontos.length > 0) && (
              <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-400">
                {data.insights.length + data.estoque.alertasPontos.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ——— VISÃO GERAL ——— */}
      {secao === "geral" && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Entrada"
              value={formatCurrency(v.entrada ?? v.faturamentoBruto)}
              sub="Máquinas faturaram no período"
              icon={Coins}
            />
            <KpiCard
              label="Lucro líquido"
              value={formatCurrency(v.liquidoOperacao ?? v.lucroLiquido)}
              sub="O que você recebeu / ficou"
              accent={(v.liquidoOperacao ?? v.lucroLiquido) >= 0 ? "green" : "red"}
              icon={(v.liquidoOperacao ?? v.lucroLiquido) >= 0 ? ArrowUpRight : ArrowDownRight}
            />
            <KpiCard
              label="Comissão"
              value={formatCurrency(v.comissao ?? 0)}
              sub="Parte do cliente / bar"
              accent="amber"
              icon={Gift}
            />
            <KpiCard
              label="Saída"
              value={formatCurrency(v.saida ?? 0)}
              sub="Saiu das máquinas"
              icon={ArrowDownRight}
            />
            {(data.nichos.furaFura || data.nichos.ursinho || data.nichos.bolinha) && (
              <KpiCard
                label="Brindes"
                value={formatCurrency(v.custoBrindesMes)}
                sub="Custo de prêmios no período"
                accent="amber"
                icon={Gift}
              />
            )}
            {data.nichos.cassino && !data.nichos.furaFura && (
              <KpiCard
                label="Visitas cassino"
                value={String(data.cassino?.visitas ?? 0)}
                sub={subPeriodo}
                icon={Gamepad2}
              />
            )}
            <KpiCard
              label="A receber · Haver"
              value={`${formatCurrency(v.aReceber)} · ${formatCurrency(v.haver)}`}
              accent="cyan"
              icon={Target}
            />
          </div>

          {(data.furaFura || data.ursinho || data.cassino) && (
            <div
              className={cn(
                "grid gap-4",
                [data.furaFura, data.ursinho, data.cassino].filter(Boolean).length >= 2
                  ? "lg:grid-cols-2 xl:grid-cols-3"
                  : "max-w-xl"
              )}
            >
              {data.furaFura && (
                <FuraFuraCaixaPainel caixa={data.furaFura.caixa} periodoLabel={data.periodoLabel} />
              )}
              {data.ursinho && (
                <FuraFuraCaixaPainel
                  caixa={data.ursinho.caixa}
                  periodoLabel={data.periodoLabel}
                  titulo="Caixa ursinho"
                  descricao="Entrada das máquinas — após comissão, antes de separar brindes"
                />
              )}
              {data.cassino && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Cassino · mês
                  </p>
                  <p className="mt-1 text-sm text-slate-400">Entrada e saída dos contadores</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Entrada</span>
                      <span className="font-semibold tabular-nums text-white">
                        {formatCurrency(data.cassino.entrada / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Saída (pago)</span>
                      <span className="font-semibold tabular-nums text-white">
                        {formatCurrency(data.cassino.saida / 100)}
                      </span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-3 flex justify-between">
                      <span className="text-sm text-green-400/90">Lucro</span>
                      <span
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          data.cassino.lucro >= 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {formatCurrency(data.cassino.lucro)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Estoque central"
              value={formatCurrency(v.valorEstoqueCentral)}
              sub={`${v.unidadesEstoqueCentral} unidades`}
              icon={Box}
            />
            <KpiCard
              label="Brindes nos pontos"
              value={formatCurrency(v.valorBrindesPontos)}
              sub={`${v.unidadesBrindesPontos} unidades alocadas`}
              icon={MapPin}
            />
            {data.nichos.furaFura && (
              <KpiCard
                label="Fura-fura"
                value={String(v.totalPontosFura)}
                sub={`${v.totalFurosMes} furos · ${data.periodoLabel}`}
                icon={Zap}
              />
            )}
            {data.nichos.cassino && (
              <KpiCard
                label="Máquinas cassino"
                value={String(v.totalMaquinasCassino)}
                sub="ativas nos pontos"
                icon={Gamepad2}
              />
            )}
            {data.nichos.ursinho && (
              <KpiCard
                label="Máquinas ursinho"
                value={String(v.totalMaquinasUrsinho)}
                sub={`${data.ursinho?.coletas ?? 0} coleta(s) · ${data.periodoLabel}`}
                icon={Box}
              />
            )}
          </div>

          {data.estoque.alertasPontos.length > 0 && (
            <div className="space-y-3">
              <SecaoTitulo
                titulo="Estoque em alerta"
                descricao="Pontos com pouco ou nenhum brinde"
              />
              <div className="flex flex-wrap gap-2">
                {data.estoque.alertasPontos.slice(0, 8).map((a) => (
                  <Link
                    key={a.pontoId}
                    href={`/pontos/${a.pontoId}`}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition hover:bg-white/[0.04]",
                      a.severidade === "danger"
                        ? "border-red-500/25 text-red-300"
                        : "border-amber-500/20 text-amber-200/90"
                    )}
                  >
                    <span className="font-medium text-white">{a.pontoNome}</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="tabular-nums">{a.resumo}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.insights.length > 0 && (
            <div className="space-y-3">
              <SecaoTitulo
                titulo={`Destaques · ${data.periodoLabel}`}
                descricao="O que mais importa agora — clique em Alertas para ver tudo"
              />
              <div className="grid gap-3 md:grid-cols-2">
                {data.insights.slice(0, 4).map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </div>
          )}

          {data.pontosAtencao.length > 0 && (
            <div className="space-y-3">
              <SecaoTitulo
                titulo="Pontos que exigem atenção"
                descricao="Priorize visita, ajuste de brinde ou revisão de máquina"
              />
              <div className="space-y-2">
                {data.pontosAtencao.slice(0, 6).map((p, i) => (
                  <RankingRow
                    key={p.pontoId}
                    pos={i + 1}
                    titulo={p.nome}
                    subtitulo={p.motivos.join(" · ")}
                    valor={formatCurrency(p.lucroMes)}
                    valorNegativo={p.lucroMes < 0}
                    href={`/pontos/${p.pontoId}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ——— FURA FURA ——— */}
      {secao === "fura" && data.furaFura && (
        <div className="space-y-8">
          <FuraFuraCaixaPainel
            caixa={data.furaFura.caixa}
            periodoLabel={data.periodoLabel}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Bruto máquina"
              value={formatCurrency(data.furaFura.caixa.brutoMaquina)}
              sub="Furos × preço (antes comissão bar)"
              icon={Coins}
            />
            <KpiCard
              label="Furos · Coletas"
              value={`${data.furaFura.totalFuros} · ${data.furaFura.coletas}`}
              sub={`volume · ${data.periodoLabel}`}
              icon={Zap}
            />
            <KpiCard
              label="Já recebido"
              value={formatCurrency(data.furaFura.caixa.recebido)}
              sub={
                data.furaFura.caixa.pendenteReceber > 0.009
                  ? `Falta ${formatCurrency(data.furaFura.caixa.pendenteReceber)}`
                  : "Coletas quitadas"
              }
              accent="cyan"
            />
            <KpiCard
              label="Haver dos pontos"
              value={formatCurrency(data.furaFura.caixa.haver)}
              sub={
                data.furaFura.caixa.haver > 0.009
                  ? "Crédito para próximas coletas"
                  : "Nenhum haver em aberto"
              }
              accent="cyan"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <SecaoTitulo
                titulo="Melhor rendimento"
                descricao={`Bars com maior lucro · ${data.periodoLabel}`}
              />
              <div className="space-y-2">
                {data.furaFura.rankingPontos.slice(0, 5).map((p, i) => (
                  <RankingRow
                    key={p.pontoId}
                    pos={i + 1}
                    titulo={p.nome}
                    subtitulo={`Caixa ${formatCurrency(p.dinheiroOperacao)} − brindes ${formatCurrency(p.custoBrindes)} · ${p.movimentos} coleta(s)`}
                    valor={formatCurrency(p.lucro)}
                    valorNegativo={p.lucro < 0}
                    href={`/pontos/${p.pontoId}`}
                  />
                ))}
                {data.furaFura.rankingPontos.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhuma coleta no período.</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <SecaoTitulo
                titulo="Maior prejuízo"
                descricao="Bars que mais pressionam a operação"
              />
              <div className="space-y-2">
                {[...data.furaFura.rankingPontos]
                  .sort((a, b) => a.lucro - b.lucro)
                  .slice(0, 5)
                  .map((p, i) => (
                    <RankingRow
                      key={p.pontoId}
                      pos={i + 1}
                      titulo={p.nome}
                      subtitulo={`Caixa ${formatCurrency(p.dinheiroOperacao)} − brindes ${formatCurrency(p.custoBrindes)} · ${p.movimentos} coleta(s)`}
                      valor={formatCurrency(p.lucro)}
                      valorNegativo={p.lucro < 0}
                      href={`/pontos/${p.pontoId}`}
                    />
                  ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SecaoTitulo
              titulo="Kits por furos (métrica principal)"
              descricao="Qual kit atrai mais jogadas — Faca vs Relógio vs Eletrônico"
            />
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Kit</th>
                    <th className="px-4 py-3 font-medium">Furos</th>
                    <th className="px-4 py-3 font-medium">Coletas</th>
                    <th className="px-4 py-3 font-medium">Média furos</th>
                    <th className="px-4 py-3 font-medium">Brindes/furo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.furaFura.rankingKits.map((k, i) => (
                    <tr key={k.kitId} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 font-medium text-white">
                        {i + 1}. {k.kitNome}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-cyan-300 font-medium">
                        {k.totalFuros}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">{k.totalColetas}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {k.mediaFurosPorColeta.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-400">
                        {k.ratioBrindesPorFuro != null ? k.ratioBrindesPorFuro.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.furaFura.rankingKits.length === 0 && (
                <p className="p-4 text-sm text-slate-500">
                  Instale kits nos pontos e registre coletas para comparar performance.
                </p>
              )}
            </div>
          </div>

          {data.furaFura.alertasBrindeKit.length > 0 && (
            <div className="space-y-3">
              <SecaoTitulo
                titulo="Alerta: brindes acima do normal"
                descricao="Possível furador mal montado ou erro operacional"
              />
              <div className="space-y-2">
                {data.furaFura.alertasBrindeKit.slice(0, 5).map((a, i) => (
                  <RankingRow
                    key={a.pontoId}
                    pos={i + 1}
                    titulo={a.pontoNome}
                    subtitulo={`${a.kitNome ?? "Kit"} · ${a.ratioAtual.toFixed(2)} brindes/furo vs média ${a.ratioMedioKit.toFixed(2)} (+${a.desvioPct.toFixed(0)}%)`}
                    valor="Verificar"
                    href={`/pontos/${a.pontoId}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <SecaoTitulo
              titulo="Performance por brinde"
              descricao={`Entregas · estoque alocado · ${data.periodoLabel}`}
            />
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Brinde</th>
                    <th className="px-4 py-3 font-medium">Entregues</th>
                    <th className="px-4 py-3 font-medium">Custo</th>
                    <th className="px-4 py-3 font-medium">Nos pontos</th>
                    <th className="px-4 py-3 font-medium">Sinal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.furaFura.rankingBrindes.map((b) => {
                    let sinal = "OK";
                    let sinalCor = "text-slate-400";
                    if (b.estoquePontos >= 3 && b.entregues === 0) {
                      sinal = "Trocar / retirar";
                      sinalCor = "text-amber-400";
                    } else if (b.entregues >= 5 && b.estoquePontos <= 2) {
                      sinal = "Repor urgente";
                      sinalCor = "text-cyan-400";
                    } else if (b.entregues >= 10) {
                      sinal = "Alta demanda";
                      sinalCor = "text-green-400";
                    }
                    return (
                      <tr key={b.nome} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-4 py-3 font-medium text-white">{b.nome}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-300">{b.entregues}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-300">
                          {formatCurrency(b.custoTotal)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-300">
                          {b.estoquePontos} un. ({formatCurrency(b.valorEstoquePontos)})
                        </td>
                        <td className={cn("px-4 py-3 text-xs font-medium", sinalCor)}>{sinal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.furaFura.rankingBrindes.length === 0 && (
                <p className="p-4 text-sm text-slate-500">Sem dados de brindes no período.</p>
              )}
            </div>
          </div>

          {data.furaFura.saudePontos.length > 0 && (
            <SaudePontosPainel itens={data.furaFura.saudePontos} />
          )}
        </div>
      )}

      {/* ——— URSINHO ——— */}
      {secao === "ursinho" && data.ursinho && (
        <div className="space-y-8">
          <FuraFuraCaixaPainel
            caixa={data.ursinho.caixa}
            periodoLabel={data.periodoLabel}
            titulo="Caixa ursinho"
            descricao="Entrada das máquinas — antes de separar brindes"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Lucro livre"
              value={formatCurrency(data.ursinho.caixa.lucroLivre)}
              accent={data.ursinho.caixa.lucroLivre >= 0 ? "green" : "red"}
            />
            <KpiCard
              label="Coletas"
              value={String(data.ursinho.coletas)}
              sub={subPeriodo}
            />
            <KpiCard
              label="Máquinas ativas"
              value={String(data.ursinho.totalMaquinas)}
              sub="nos pontos"
            />
            <KpiCard
              label="Custo brindes"
              value={formatCurrency(data.ursinho.caixa.reservaBrindes)}
              sub="Prêmios entregues"
              accent="amber"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <SecaoTitulo titulo="Pontos — melhor lucro" descricao={`Ranking · ${data.periodoLabel}`} />
              <div className="space-y-2">
                {data.ursinho.rankingPontos.slice(0, 5).map((p, i) => (
                  <RankingRow
                    key={p.pontoId}
                    pos={i + 1}
                    titulo={p.nome}
                    subtitulo={`${p.movimentos} coleta(s) · brindes ${formatCurrency(p.custoBrindes)}`}
                    valor={formatCurrency(p.lucro)}
                    valorNegativo={p.lucro < 0}
                    href={`/pontos/${p.pontoId}`}
                  />
                ))}
                {data.ursinho.rankingPontos.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhuma coleta no período.</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <SecaoTitulo titulo="Pontos — mais pressão" descricao={`Menor lucro · ${data.periodoLabel}`} />
              <div className="space-y-2">
                {[...data.ursinho.rankingPontos]
                  .sort((a, b) => a.lucro - b.lucro)
                  .slice(0, 5)
                  .map((p, i) => (
                    <RankingRow
                      key={p.pontoId}
                      pos={i + 1}
                      titulo={p.nome}
                      subtitulo={`${p.movimentos} coleta(s)`}
                      valor={formatCurrency(p.lucro)}
                      valorNegativo={p.lucro < 0}
                      href={`/pontos/${p.pontoId}`}
                    />
                  ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SecaoTitulo
              titulo="Máquinas com mais potencial"
              descricao="Lucro e volume — priorize as que rendem"
            />
            <div className="space-y-2">
              {data.ursinho.rankingMaquinas.slice(0, 8).map((m, i) => (
                <RankingRow
                  key={m.equipamentoId}
                  pos={i + 1}
                  titulo={m.nome}
                  subtitulo={`${m.pontoNome}${m.numeroMaquina ? ` · #${m.numeroMaquina}` : ""} · entrada ${formatCurrency(m.entrada / 100)} · ${m.leituras} coleta(s)`}
                  valor={formatCurrency(m.lucro)}
                  valorNegativo={m.lucro < 0}
                  href={`/pontos/${m.pontoId}`}
                />
              ))}
              {data.ursinho.rankingMaquinas.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma coleta no período.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SecaoTitulo titulo="Brindes entregues" descricao="O que mais saiu das máquinas no período" />
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Brinde</th>
                    <th className="px-4 py-3 font-medium">Entregues</th>
                    <th className="px-4 py-3 font-medium">Custo</th>
                    <th className="px-4 py-3 font-medium">Coletas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ursinho.rankingBrindes.map((b) => (
                    <tr key={b.nome} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{b.nome}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">{b.entregues}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-400">
                        {formatCurrency(b.custoTotal)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">{b.coletasComEntrega}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.ursinho.rankingBrindes.length === 0 && (
                <p className="p-4 text-sm text-slate-500">Sem dados de brindes no período.</p>
              )}
            </div>
          </div>

          {data.ursinho.saudePontos.length > 0 && (
            <SaudePontosPainel itens={data.ursinho.saudePontos} />
          )}
        </div>
      )}

      {/* ——— CASSINO ——— */}
      {secao === "cassino" && data.cassino && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Lucro líquido"
              value={formatCurrency(data.cassino.lucro)}
              sub="O que você recebeu do cliente"
              accent={data.cassino.lucro >= 0 ? "green" : "red"}
            />
            <KpiCard
              label="Entrada"
              value={formatCurrency(data.cassino.entrada / 100)}
              sub="Máquinas faturaram"
            />
            <KpiCard
              label="Saída"
              value={formatCurrency(data.cassino.saida / 100)}
              sub={
                data.cassino.entrada > 0
                  ? `${((data.cassino.saida / data.cassino.entrada) * 100).toFixed(1)}% pago`
                  : undefined
              }
            />
            <KpiCard label="Visitas" value={String(data.cassino.visitas)} sub={subPeriodo} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <SecaoTitulo titulo="Bars — melhor lucro" descricao={`Ranking · ${data.periodoLabel}`} />
              <div className="space-y-2">
                {data.cassino.rankingPontos.slice(0, 5).map((p, i) => (
                  <RankingRow
                    key={p.pontoId}
                    pos={i + 1}
                    titulo={p.nome}
                    subtitulo={`${p.movimentos} visita(s)`}
                    valor={formatCurrency(p.lucro)}
                    valorNegativo={p.lucro < 0}
                    href={`/pontos/${p.pontoId}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <SecaoTitulo titulo="Bars — mais pressão" descricao={`Menor lucro · ${data.periodoLabel}`} />
              <div className="space-y-2">
                {[...data.cassino.rankingPontos]
                  .sort((a, b) => a.lucro - b.lucro)
                  .slice(0, 5)
                  .map((p, i) => (
                    <RankingRow
                      key={p.pontoId}
                      pos={i + 1}
                      titulo={p.nome}
                      subtitulo={`${p.movimentos} visita(s)`}
                      valor={formatCurrency(p.lucro)}
                      valorNegativo={p.lucro < 0}
                      href={`/pontos/${p.pontoId}`}
                    />
                  ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SecaoTitulo
              titulo="Máquinas com mais potencial"
              descricao="Lucro · volume jogado · % pago — priorize as que rendem"
            />
            <div className="space-y-2">
              {data.cassino.rankingMaquinas.slice(0, 8).map((m, i) => (
                <RankingRow
                  key={m.equipamentoId}
                  pos={i + 1}
                  titulo={m.nome}
                  subtitulo={`${m.pontoNome}${m.numeroMaquina ? ` · #${m.numeroMaquina}` : ""} · entrada ${formatCurrency(m.entrada / 100)}${m.pctPago != null ? ` · paga ${m.pctPago.toFixed(1)}%` : ""}`}
                  valor={formatCurrency(m.lucro)}
                  valorNegativo={m.lucro < 0}
                  href={`/pontos/${m.pontoId}`}
                />
              ))}
              {data.cassino.rankingMaquinas.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma leitura no período.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SecaoTitulo
              titulo="Tipos de jogo"
              descricao="Agrupado pelo nome da máquina — o que mais joga e o que mais paga"
            />
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Jogo / modelo</th>
                    <th className="px-4 py-3 font-medium">Máquinas</th>
                    <th className="px-4 py-3 font-medium">Entrada</th>
                    <th className="px-4 py-3 font-medium">% pago</th>
                    <th className="px-4 py-3 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cassino.rankingJogos.map((j) => (
                    <tr key={j.nome} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{j.nome}</td>
                      <td className="px-4 py-3 text-slate-300">{j.maquinas}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {formatCurrency(j.entrada / 100)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {j.pctPago != null ? `${j.pctPago.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 tabular-nums font-medium",
                          j.lucro >= 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {formatCurrency(j.lucro)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.cassino.saudePontos.length > 0 && (
            <SaudePontosPainel itens={data.cassino.saudePontos} />
          )}
        </div>
      )}

      {secao === "diversao" && data.diversao && (
        <NichoColetaPainel
          bloco={data.diversao}
          periodoLabel={data.periodoLabel}
          tituloCaixa="Caixa diversão"
          descricaoCaixa="Sinuca, fliperama, massagem — entrada líquida da operação"
          showBrindes={false}
        />
      )}

      {secao === "bolinha" && data.bolinha && (
        <NichoColetaPainel
          bloco={data.bolinha}
          periodoLabel={data.periodoLabel}
          tituloCaixa="Caixa bolinha"
          descricaoCaixa="Entrada das máquinas — antes de separar brindes"
          labelItens="Brindes"
          showBrindes
        />
      )}

      {secao === "consignado" && data.consignado && (
        <NichoColetaPainel
          bloco={data.consignado}
          periodoLabel={data.periodoLabel}
          tituloCaixa="Caixa consignado"
          descricaoCaixa="Vendas no expositor — lucro após custo dos produtos"
          labelItens="Produtos vendidos"
          showBrindes
        />
      )}

      {/* ——— CAPITAL ——— */}
      {secao === "capital" && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Valor estoque central"
              value={formatCurrency(data.estoque.valorTotal)}
              sub={`${v.unidadesEstoqueCentral} unidades · ${data.estoque.itens.length} itens`}
              icon={Box}
            />
            <KpiCard
              label="Brindes alocados"
              value={formatCurrency(v.valorBrindesPontos)}
              sub={`${v.unidadesBrindesPontos} unidades nos pontos`}
              icon={MapPin}
            />
            <KpiCard
              label="Capital total parado"
              value={formatCurrency(data.estoque.valorTotal + v.valorBrindesPontos)}
              sub="central + pontos"
              accent="cyan"
              icon={BarChart3}
            />
          </div>

          {data.estoque.itensAbaixoMinimo > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-sm text-amber-200/90">
              {data.estoque.itensAbaixoMinimo} item(ns) abaixo do estoque mínimo — repor antes da
              próxima rota.
            </div>
          )}

          {data.estoque.alertasPontos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <SecaoTitulo
                  titulo="Estoque em alerta nos pontos"
                  descricao="Resumo rápido — pontos zerados ou com pouco brinde"
                />
                <Link
                  href="/estoque/alocados"
                  className="shrink-0 text-xs text-primary-neon hover:underline"
                >
                  Ver alocados →
                </Link>
              </div>
              <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
                {data.estoque.alertasPontos.map((a) => (
                  <Link
                    key={a.pontoId}
                    href={`/pontos/${a.pontoId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{a.pontoNome}</p>
                      <p
                        className={cn(
                          "truncate text-sm tabular-nums",
                          a.severidade === "danger" ? "text-red-400" : "text-amber-400/90"
                        )}
                      >
                        {a.resumo}
                      </p>
                    </div>
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0",
                        a.severidade === "danger" ? "text-red-400" : "text-amber-400"
                      )}
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <SecaoTitulo titulo="Inventário central" descricao="Quantidade · custo · valor imobilizado" />
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Qtd</th>
                    <th className="px-4 py-3 font-medium">Custo un.</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.estoque.itens.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{item.nome}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">{item.quantidade}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {formatCurrency(item.custoUnitario)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {formatCurrency(item.valorTotal)}
                      </td>
                      <td className="px-4 py-3">
                        {item.abaixoMinimo ? (
                          <span className="text-xs font-medium text-amber-400">Abaixo do mín.</span>
                        ) : (
                          <span className="text-xs text-slate-500">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.estoque.itens.length === 0 && (
                <p className="p-4 text-sm text-slate-500">
                  Estoque vazio.{" "}
                  <Link href="/estoque" className="text-primary-neon hover:underline">
                    Cadastrar itens
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/estoque"
              className="text-sm text-primary-neon hover:underline"
            >
              Gerenciar estoque →
            </Link>
          </div>
        </div>
      )}

      {/* ——— ALERTAS ——— */}
      {secao === "alertas" && (
        <div className="space-y-6">
          {data.estoque.alertasPontos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <SecaoTitulo
                  titulo="Estoque nos pontos"
                  descricao="Ex.: Pikiri — 0 brindes · Bicão — faca 3"
                />
                <Link
                  href="/estoque/alocados"
                  className="shrink-0 text-xs text-primary-neon hover:underline"
                >
                  Ver alocados →
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.estoque.alertasPontos.map((a) => (
                  <Link
                    key={a.pontoId}
                    href={`/pontos/${a.pontoId}`}
                    className={cn(
                      "rounded-xl border px-4 py-3 transition hover:bg-white/[0.03]",
                      a.severidade === "danger"
                        ? "border-red-500/25 bg-red-500/[0.04]"
                        : "border-amber-500/20 bg-amber-500/[0.04]"
                    )}
                  >
                    <p className="font-medium text-white">{a.pontoNome}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm tabular-nums",
                        a.severidade === "danger" ? "text-red-300" : "text-amber-200/90"
                      )}
                    >
                      {a.resumo}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <SecaoTitulo
            titulo="Recomendações acionáveis"
            descricao="O que fazer agora — trocar brinde, repor estoque, visitar ponto ou rotacionar máquina"
          />
          {data.insights.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-slate-500">
              Sem alertas no momento. Continue registrando coletas e visitas para insights
              automáticos.
            </p>
          )}

          {data.pontosAtencao.length > 0 && (
            <div className="space-y-3">
              <SecaoTitulo titulo="Mapa de atenção" descricao="Todos os pontos prioritários" />
              <div className="space-y-2">
                {data.pontosAtencao.map((p, i) => (
                  <RankingRow
                    key={p.pontoId}
                    pos={i + 1}
                    titulo={p.nome}
                    subtitulo={p.motivos.join(" · ")}
                    valor={formatCurrency(p.lucroMes)}
                    valorNegativo={p.lucroMes < 0}
                    href={`/pontos/${p.pontoId}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ——— ANÁLISE INTELIGENTE ——— */}
      {secao === "ia" && (
        <div className="space-y-4">
          <SecaoTitulo
            titulo="Análise Inteligente"
            descricao={`Pergunte sobre fura-fura, cassino, urso/pelúcia, pontos, rotas e estoque — ${data.periodoLabel.toLowerCase()}`}
          />
          <InteligenciaIAPainel
            semCabecalho
            periodoLabel={data.periodoLabel}
            periodoPreset={data.periodoPreset}
          />
        </div>
      )}
    </div>
  );
}
