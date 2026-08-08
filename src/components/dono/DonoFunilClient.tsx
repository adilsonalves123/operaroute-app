"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import type { DonoCommandPayload } from "@/lib/dono/command";
import { cn } from "@/lib/utils";

function money(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function DonoFunilClient({ email }: { email: string }) {
  const [data, setData] = useState<DonoCommandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dono/command");
        const json = await res.json();
        if (!res.ok) {
          setErro(json.error ?? "Falha.");
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

  const maxStep = Math.max(1, ...(data?.funil.steps.map((s) => s.count) ?? [1]));

  return (
    <DonoShell
      email={email}
      badgeSuporte={data?.suporte.humano_aberto}
      title="Funil & crescimento"
      subtitle="Da visita ao cliente ativo — onde as pessoas entram, travam e convertem."
    >
      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}
      {erro && (
        <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      {data && (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
            {[
              { l: "Visitas 7d", v: data.funil.visitas_7d },
              { l: "Visitas 30d", v: data.funil.visitas_30d },
              { l: "Cadastros 7d", v: data.funil.cadastros_7d },
              {
                l: "Taxa onboarding",
                v: `${data.funil.taxa_conversao_onboarding_pct}%`,
              },
            ].map((c) => (
              <div key={c.l} className="bg-[#080b12] px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {c.l}
                </p>
                <p className="mt-1.5 text-[22px] tabular-nums text-[#f4efe6]">
                  {c.v}
                </p>
              </div>
            ))}
          </div>

          <section>
            <p className="mb-4 text-[11px] uppercase tracking-[0.16em] text-slate-600">
              Pipeline visual
            </p>
            <div className="space-y-3">
              {data.funil.steps.map((s) => (
                <div key={s.id}>
                  <div className="mb-1 flex items-end justify-between gap-3 text-[13px]">
                    <span className="text-[#f4efe6]">{s.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {s.count}
                      {s.pct_do_anterior != null && (
                        <span className="ml-2 text-[11px] text-slate-600">
                          {s.pct_do_anterior}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-white/[0.06]">
                    <div
                      className="h-full rounded-sm bg-gradient-to-r from-[#c4a574]/80 to-[#c4a574]/35 transition-all"
                      style={{ width: `${Math.max(4, (s.count / maxStep) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-slate-500">{data.funil.aviso_app}</p>
          </section>

          <div className="grid gap-8 lg:grid-cols-3">
            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Conversão
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07] text-[13px]">
                <Row
                  label="Criaram conta"
                  value={String(data.funil.cadastros_total)}
                />
                <Row
                  label="Terminaram onboarding"
                  value={String(data.funil.converteram_onboarding)}
                />
                <Row
                  label="Não converteram"
                  value={String(data.funil.nao_converteram_onboarding)}
                  warn
                />
                <Row label="Em trial" value={String(data.overview.trials)} />
                <Row label="Ativos" value={String(data.overview.ativos)} />
                <Row
                  label="Trial ≤3d"
                  value={String(data.overview.trials_expirando)}
                  warn
                />
              </ul>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Objetivos (pesquisa)
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
                {data.pesquisa.por_objetivo.map((o) => (
                  <li
                    key={o.objetivo}
                    className="flex justify-between gap-2 px-4 py-3 text-[13px]"
                  >
                    <span className="text-[#f4efe6]">{o.objetivo}</span>
                    <span className="tabular-nums text-slate-500">{o.count}</span>
                  </li>
                ))}
                {data.pesquisa.por_objetivo.length === 0 && (
                  <li className="px-4 py-8 text-center text-[12px] text-slate-500">
                    Sem dados.
                  </li>
                )}
              </ul>
              <p className="mt-3 text-[12px] text-slate-500">
                Funcionários: {data.pesquisa.possui_funcionarios.sim} sim ·{" "}
                {data.pesquisa.possui_funcionarios.nao} não
              </p>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Faixa × MRR
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
                {data.pesquisa.por_faixa.map((f) => (
                  <li
                    key={f.faixa}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-[13px]"
                  >
                    <span className="text-[#f4efe6]">{f.faixa}</span>
                    <span className="text-slate-500">{f.count}</span>
                    <span className="tabular-nums text-[#e8d5b0]">
                      {money(f.mrr)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dono/ia"
              className="rounded-sm border border-[#c4a574]/35 bg-[#c4a574]/10 px-4 py-2.5 text-[13px] text-[#e8d5b0]"
            >
              IA · analisar conversões
            </Link>
            <Link
              href="/dono/empresas?saude=trial_expirando"
              className="rounded-sm border border-white/10 px-4 py-2.5 text-[13px] text-slate-400 hover:text-[#f4efe6]"
            >
              Ver trials acabando
            </Link>
          </div>
        </div>
      )}
    </DonoShell>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <li className="flex justify-between px-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          warn ? "text-rose-300" : "text-[#f4efe6]"
        )}
      >
        {value}
      </span>
    </li>
  );
}
