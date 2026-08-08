"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CreditCard,
  Loader2,
  Package,
  Wallet,
} from "lucide-react";
import {
  DonoShell,
  nomeDoEmail,
  saudacaoHora,
} from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import { DonoNichosCarousel } from "@/components/dono/DonoNichosCarousel";
import type { DonoCommandPayload } from "@/lib/dono/command";
import { cn } from "@/lib/utils";

function money(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function moneyC(c: number) {
  return (c / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDay(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function MiniBars({
  values,
  labels,
  formatTip,
  light,
}: {
  values: number[];
  labels: string[];
  formatTip?: (n: number) => string;
  light: boolean;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-36 items-end gap-2">
      {values.map((v, i) => (
        <div key={labels[i] + i} className="flex flex-1 flex-col items-center gap-2">
          <div
            title={formatTip ? formatTip(v) : String(v)}
            className={cn(
              "w-full rounded-md transition",
              light ? "bg-stone-900/80" : "bg-[#c4a574]/55"
            )}
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          />
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide",
              light ? "text-slate-500" : "text-slate-500"
            )}
          >
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DonoCommandClient({ email }: { email: string }) {
  const [data, setData] = useState<DonoCommandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const { theme } = useDonoTheme();
  const light = theme === "light";
  const nome = nomeDoEmail(email);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dono/command");
        const json = await res.json();
        if (!res.ok) {
          setErro(json.error ?? "Falha ao carregar.");
          return;
        }
        setData(json);
      } catch {
        setErro("Falha de rede.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const card = light
    ? "rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5";
  const muted = light ? "text-slate-500" : "text-slate-500";
  const title = light ? "text-slate-900" : "text-[#f4efe6]";

  return (
    <DonoShell
      email={email}
      badgeSuporte={data?.suporte.humano_aberto}
      title={saudacaoHora(nome)}
      hideTitle
    >
      {loading && (
        <div className={cn("flex items-center gap-2 text-[13px]", muted)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dashboard…
        </div>
      )}
      {erro && (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">
          {erro}
        </p>
      )}

      {data?.crm && (
        <div className="space-y-8">
          <div>
            <p className={cn("text-[13px]", muted)}>Painel da plataforma</p>
            <h1
              className={cn("mt-1 text-[clamp(1.8rem,3vw,2.4rem)] tracking-tight", title)}
              style={{ fontFamily: "var(--font-dono-display), Georgia, serif" }}
            >
              {saudacaoHora(nome)}
            </h1>
          </div>

          {/* KPIs topo */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              {
                label: "MRR (pago)",
                value: money(data.overview.mrr_estimado),
                tip:
                  data.overview.mrr_potencial > 0
                    ? `Potencial catálogo ${money(data.overview.mrr_potencial)}`
                    : "Só conta pagamento confirmado",
              },
              {
                label: "Clientes ativos",
                value: String(data.overview.ativos),
                tip: "Com pagamento confirmado",
              },
              {
                label: "Assinaturas em teste",
                value: String(data.overview.trials),
              },
              {
                label: "Receita do mês",
                value: moneyC(data.crm.receita_mes_centavos),
                tip: "Caixa real (Mercado Pago)",
              },
              {
                label: "Churn",
                value: `${data.crm.churn_rate_pct}%`,
                tip:
                  data.crm.churn_30d > 0
                    ? `${data.crm.churn_30d} expirados / cancelados`
                    : "Sem cancelamentos na base",
              },
            ].map((k) => (
              <div key={k.label} className={card}>
                <p className={cn("text-[11px] uppercase tracking-[0.12em]", muted)}>
                  {k.label}
                </p>
                <p className={cn("mt-2 text-[24px] font-medium tabular-nums", title)}>
                  {k.value}
                </p>
                {k.tip && <p className={cn("mt-1 text-[11px]", muted)}>{k.tip}</p>}
              </div>
            ))}
          </div>

          <DonoNichosCarousel
            contagens={data.pesquisa.por_nicho}
            light={light}
          />

          {/* Cards principais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: "/dono/empresas",
                icon: Building2,
                label: "Clientes",
                value: String(data.overview.total_empresas),
                tip:
                  (data.overview.orfas_ocultas ?? 0) > 0
                    ? `${data.overview.novos_7d} novos · ${data.overview.orfas_ocultas} órfãs ocultas`
                    : `${data.overview.novos_7d} novos em 7 dias`,
              },
              {
                href: "/dono/assinaturas",
                icon: CreditCard,
                label: "Assinaturas pagas",
                value: String(data.crm.assinaturas_ativas),
                tip: `${data.crm.ciclos.mensal} mensal · ${data.crm.ciclos.anual} anual (ativo/trial)`,
              },
              {
                href: "/dono/receita",
                icon: Wallet,
                label: "Faturamento",
                value: moneyC(data.crm.receita_mes_centavos),
                tip:
                  data.overview.mrr_estimado > 0
                    ? `ARR pago ${money(data.overview.arr_estimado)}`
                    : "Sem pagamentos neste mês",
              },
              {
                href: "/dono/planos",
                icon: Package,
                label: "Planos vendidos",
                value: String(
                  data.crm.planos_vendidos.reduce((s, p) => s + p.count, 0)
                ),
                tip:
                  data.crm.planos_vendidos
                    .slice(0, 3)
                    .map((p) => `${p.plano} ${p.count}`)
                    .join(" · ") || "Nenhuma venda paga",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  className={cn(card, "group transition hover:-translate-y-0.5")}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        light ? "bg-stone-100" : "bg-white/[0.05]"
                      )}
                    >
                      <Icon className="h-4 w-4 opacity-80" />
                    </div>
                    <ArrowUpRight
                      className={cn(
                        "h-4 w-4 opacity-0 transition group-hover:opacity-60",
                        muted
                      )}
                    />
                  </div>
                  <p className={cn("mt-4 text-[12px]", muted)}>{c.label}</p>
                  <p className={cn("mt-1 text-[26px] font-medium tabular-nums", title)}>
                    {c.value}
                  </p>
                  <p className={cn("mt-1 text-[11px]", muted)}>{c.tip}</p>
                </Link>
              );
            })}
          </div>

          {/* Gráficos */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className={card}>
              <p className={cn("mb-4 text-[13px] font-medium", title)}>
                Novos clientes por mês
              </p>
              <MiniBars
                light={light}
                values={data.crm.novos_por_mes.map((x) => x.count)}
                labels={data.crm.novos_por_mes.map((x) => x.label)}
              />
            </div>
            <div className={card}>
              <p className={cn("mb-4 text-[13px] font-medium", title)}>
                Receita mensal
              </p>
              <MiniBars
                light={light}
                values={data.crm.receita_por_mes.map((x) => x.centavos)}
                labels={data.crm.receita_por_mes.map((x) => x.label)}
                formatTip={(n) => moneyC(n)}
              />
            </div>
            <div className={card}>
              <p className={cn("mb-4 text-[13px] font-medium", title)}>
                Crescimento da plataforma
              </p>
              <MiniBars
                light={light}
                values={data.crm.crescimento.map((x) => x.total)}
                labels={data.crm.crescimento.map((x) => x.label)}
                formatTip={(n) => `${n} clientes`}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            {/* Clientes recentes */}
            <div className={cn(card, "overflow-hidden p-0")}>
              <div className="flex items-center justify-between px-5 py-4">
                <p className={cn("text-[13px] font-medium", title)}>
                  Clientes recentes
                </p>
                <Link
                  href="/dono/empresas"
                  className={cn("text-[12px] hover:underline", muted)}
                >
                  Ver todos
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead>
                    <tr
                      className={cn(
                        "border-y text-[10px] uppercase tracking-[0.12em]",
                        light
                          ? "border-stone-100 text-slate-500"
                          : "border-white/[0.05] text-slate-500"
                      )}
                    >
                      <th className="px-5 py-2.5 font-medium">Empresa</th>
                      <th className="px-3 py-2.5 font-medium">Plano</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.crm.clientes_recentes.map((c) => (
                      <tr
                        key={c.id}
                        className={cn(
                          "border-b last:border-0",
                          light ? "border-stone-50" : "border-white/[0.04]"
                        )}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/dono/empresas/${c.id}`}
                            className={cn("font-medium hover:underline", title)}
                          >
                            {c.empresa}
                          </Link>
                        </td>
                        <td className={cn("px-3 py-3", muted)}>{c.plano}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px]",
                              c.status === "Ativo" &&
                                (light
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-emerald-500/15 text-emerald-300"),
                              c.status === "Trial" &&
                                (light
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-amber-500/15 text-amber-200"),
                              c.status !== "Ativo" &&
                                c.status !== "Trial" &&
                                (light
                                  ? "bg-stone-100 text-slate-600"
                                  : "bg-white/5 text-slate-400")
                            )}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className={cn("px-5 py-3 tabular-nums", muted)}>
                          {formatDay(c.vencimento)}
                        </td>
                      </tr>
                    ))}
                    {data.crm.clientes_recentes.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className={cn("px-5 py-10 text-center text-[12px]", muted)}
                        >
                          Nenhum cliente ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alertas */}
            <div className={card}>
              <p className={cn("mb-3 flex items-center gap-2 text-[13px] font-medium", title)}>
                <AlertTriangle className="h-4 w-4 opacity-70" />
                Alertas
              </p>
              <ul className="space-y-2">
                {data.alertas.length === 0 && (
                  <li className={cn("rounded-xl px-3 py-6 text-center text-[12px]", muted)}>
                    Tudo sob controle.
                  </li>
                )}
                {data.alertas.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href ?? "/dono"}
                      className={cn(
                        "block rounded-xl border px-3 py-2.5 transition",
                        a.severidade === "critical" &&
                          (light
                            ? "border-rose-200 bg-rose-50 hover:bg-rose-100/70"
                            : "border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15"),
                        a.severidade === "high" &&
                          (light
                            ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70"
                            : "border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15"),
                        a.severidade === "info" &&
                          (light
                            ? "border-stone-200 bg-stone-50 hover:bg-stone-100"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]")
                      )}
                    >
                      <p className={cn("text-[13px]", title)}>{a.titulo}</p>
                      <p className={cn("mt-0.5 text-[11px]", muted)}>{a.detalhe}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </DonoShell>
  );
}
