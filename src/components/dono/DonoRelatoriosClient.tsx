"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { DonoNichosCarousel } from "@/components/dono/DonoNichosCarousel";
import type { DonoCommandPayload } from "@/lib/dono/command";
import { cn } from "@/lib/utils";
import { useDonoTheme } from "@/components/dono/DonoTheme";

export function DonoRelatoriosClient({ email }: { email: string }) {
  const [data, setData] = useState<DonoCommandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useDonoTheme();
  const light = theme === "light";

  useEffect(() => {
    void fetch("/api/dono/command")
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, []);

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-at bg-white/[0.02] p-5";

  return (
    <DonoShell
      email={email}
      badgeSuporte={data?.suporte.humano_aberto}
      title="Relatórios"
      subtitle="Funil, crescimento, nichos e atalhos de análise."
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin text-at-muted" />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                l: "Conversão onboarding",
                v: `${data.funil.taxa_conversao_onboarding_pct}%`,
              },
              { l: "Cadastros 7d", v: String(data.funil.cadastros_7d) },
              { l: "Visitas 30d", v: String(data.funil.visitas_30d) },
              { l: "Churn", v: `${data.crm.churn_rate_pct}%` },
            ].map((x) => (
              <div key={x.l} className={card}>
                <p className="text-[11px] uppercase tracking-wider text-at-muted">
                  {x.l}
                </p>
                <p className="mt-2 text-[24px] tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={card}>
              <p className="mb-3 text-[13px] font-medium">Funil (passos)</p>
              <ul className="space-y-2">
                {data.funil.steps.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between text-[13px]"
                  >
                    <span>{s.label}</span>
                    <span className="tabular-nums text-at-muted">
                      {s.count}
                      {s.pct_do_anterior != null && (
                        <span className="ml-2 text-[11px]">
                          {s.pct_do_anterior}%
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn(card, "overflow-hidden")}>
              <DonoNichosCarousel
                contagens={data.pesquisa.por_nicho}
                light={light}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { href: "/dono/funil", label: "Funil detalhado" },
              { href: "/dono/atividade", label: "Atividade / acessos" },
              { href: "/dono/ia", label: "IA Copiloto" },
              { href: "/dono/receita", label: "Financeiro" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-[13px] transition",
                  light
                    ? "border-stone-200 hover:bg-stone-50"
                    : "border-at-soft hover:bg-at-card-soft"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </DonoShell>
  );
}
