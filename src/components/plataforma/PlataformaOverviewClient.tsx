"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { PlataformaShell } from "@/components/plataforma/PlataformaShell";
import type { PlataformaOverview, TenantResumo } from "@/lib/plataforma/tenants";
import { cn } from "@/lib/utils";

const SAUDE_LABEL: Record<string, string> = {
  ativo: "Ativo",
  trial: "Trial",
  trial_expirando: "Trial acabando",
  trial_expirado: "Trial expirado",
  inativo: "Inativo",
  suspenso: "Suspenso",
};

const SAUDE_STYLE: Record<string, string> = {
  ativo: "text-emerald-300/90 border-emerald-500/25 bg-emerald-500/[0.06]",
  trial: "text-[#e8d5b0] border-[#c4a574]/30 bg-[#c4a574]/10",
  trial_expirando: "text-amber-200 border-amber-500/30 bg-amber-500/10",
  trial_expirado: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  inativo: "text-slate-400 border-white/10 bg-white/[0.03]",
  suspenso: "text-rose-200 border-rose-500/35 bg-rose-500/15",
};

function money(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function PlataformaOverviewClient() {
  const [overview, setOverview] = useState<PlataformaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/plataforma/overview");
        const data = await res.json();
        if (!res.ok) {
          setErro(data.error ?? "Falha ao carregar.");
          return;
        }
        setOverview(data.overview);
      } catch {
        setErro("Falha de rede.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PlataformaShell
      title="Painel do dono"
      subtitle="MRR pago, clientes reais, trials em risco e suporte — o pulso do OperaRoute."
    >
      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando métricas…
        </div>
      )}

      {erro && (
        <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      {overview && (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
            {[
              {
                label: "MRR (pago)",
                value: money(overview.mrr_estimado),
                tip:
                  overview.mrr_potencial > 0
                    ? `Catálogo ${money(overview.mrr_potencial)}`
                    : "Só pagamento confirmado",
              },
              { label: "ARR (pago)", value: money(overview.arr_estimado) },
              {
                label: "Clientes",
                value: String(overview.total_empresas),
                tip:
                  overview.orfas_ocultas > 0
                    ? `${overview.orfas_ocultas} órfãs ocultas`
                    : undefined,
              },
              {
                label: "ARPU",
                value: money(overview.arpu),
                tip: "MRR ÷ pagantes",
              },
            ].map((c) => (
              <div key={c.label} className="bg-[#0a0e16]/95 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {c.label}
                </p>
                <p className="mt-1.5 text-[22px] font-medium tabular-nums text-[#f4efe6]">
                  {c.value}
                </p>
                {c.tip && <p className="mt-1 text-[10px] text-slate-600">{c.tip}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Ativos", value: overview.ativos },
              { label: "Em trial", value: overview.trials },
              { label: "Trial ≤3d", value: overview.trials_expirando, warn: true },
              { label: "Expirados", value: overview.trials_expirados, warn: true },
              { label: "Novos 7d", value: overview.novos_7d },
              { label: "Suporte humano", value: overview.suporte_humano_aberto, amber: true },
            ].map((c) => (
              <div key={c.label} className="bg-[#0a0e16]/95 px-3 py-3.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  {c.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[20px] font-medium tabular-nums",
                    c.warn ? "text-rose-300" : c.amber ? "text-amber-200" : "text-[#f4efe6]"
                  )}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                <TrendingUp className="h-3.5 w-3.5" />
                Por faixa de pontos
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
                {overview.por_faixa.map((f) => (
                  <li
                    key={f.faixa}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
                  >
                    <span className="text-[#f4efe6]">{f.faixa} pts</span>
                    <span className="text-slate-500">{f.count} clientes</span>
                    <span className="tabular-nums text-slate-400">{money(f.mrr)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Nichos mais usados
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
                {overview.por_nicho.slice(0, 8).map((n) => (
                  <li
                    key={n.nicho}
                    className="flex items-center justify-between px-4 py-3 text-[13px]"
                  >
                    <span className="text-[#f4efe6]">{n.nicho.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-slate-500">{n.count}</span>
                  </li>
                ))}
                {overview.por_nicho.length === 0 && (
                  <li className="px-4 py-6 text-center text-[12px] text-slate-500">
                    Sem dados de nicho ainda.
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <TenantLista
              titulo="Em risco"
              icon
              itens={overview.em_risco}
              empty="Nenhum cliente em risco no momento."
            />
            <TenantLista
              titulo="Cadastros recentes"
              itens={overview.recentes}
              empty="Ainda sem empresas."
            />
          </div>

          {overview.onboarding_incompleto > 0 && (
            <p className="text-[12px] text-slate-500">
              {overview.onboarding_incompleto} conta(s) com onboarding incompleto.
            </p>
          )}
        </div>
      )}
    </PlataformaShell>
  );
}

function TenantLista({
  titulo,
  itens,
  empty,
  icon,
}: {
  titulo: string;
  itens: TenantResumo[];
  empty: string;
  icon?: boolean;
}) {
  return (
    <section>
      <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-600">
        {icon && <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80" />}
        {titulo}
      </p>
      <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
        {itens.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-slate-500">{empty}</li>
        )}
        {itens.map((t) => (
          <li key={t.id}>
            <Link
              href={`/plataforma/empresas/${t.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[#f4efe6]">{t.nome_operacao}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {t.owner_nome ?? "—"} · {t.owner_email ?? "sem e-mail"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  SAUDE_STYLE[t.saude] ?? SAUDE_STYLE.inativo
                )}
              >
                {SAUDE_LABEL[t.saude] ?? t.saude}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
