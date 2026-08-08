"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { PlataformaShell } from "@/components/plataforma/PlataformaShell";
import type { TenantResumo } from "@/lib/plataforma/tenants";
import { cn } from "@/lib/utils";

const SAUDE_OPTS = [
  { id: "todos", label: "Todos" },
  { id: "ativo", label: "Ativos" },
  { id: "trial", label: "Trial" },
  { id: "trial_expirando", label: "Trial acabando" },
  { id: "trial_expirado", label: "Expirados" },
  { id: "suspenso", label: "Suspensos" },
];

const SAUDE_LABEL: Record<string, string> = {
  ativo: "Ativo",
  trial: "Trial",
  trial_expirando: "Acabando",
  trial_expirado: "Expirado",
  inativo: "Inativo",
  suspenso: "Suspenso",
};

function money(n: number | null) {
  if (n == null) return "Sob consulta";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function PlataformaEmpresasClient() {
  const [tenants, setTenants] = useState<TenantResumo[]>([]);
  const [q, setQ] = useState("");
  const [saude, setSaude] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (saude !== "todos") params.set("saude", saude);
      const res = await fetch(`/api/plataforma/empresas?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha.");
        return;
      }
      setErro("");
      setTenants(data.tenants ?? []);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, [q, saude]);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 200);
    return () => window.clearTimeout(id);
  }, [carregar]);

  return (
    <PlataformaShell
      title="Clientes"
      subtitle="Todas as operações OperaRoute — busca, saúde da conta e MRR estimado."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, e-mail ou ID…"
            className="w-full rounded-sm border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-[13px] text-[#f4efe6] outline-none focus:border-[#c4a574]/35"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAUDE_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSaude(o.id)}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-[11px] uppercase tracking-wider transition",
                saude === o.id
                  ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#e8d5b0]"
                  : "border-white/10 text-slate-500 hover:text-slate-300"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-sm border border-white/[0.07]">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <th className="px-4 py-3 font-medium">Operação</th>
              <th className="px-4 py-3 font-medium">Dono</th>
              <th className="px-4 py-3 font-medium">Saúde</th>
              <th className="px-4 py-3 font-medium">Uso</th>
              <th className="px-4 py-3 font-medium text-right">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Nenhum cliente neste filtro.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="transition hover:bg-white/[0.015]">
                <td className="px-4 py-3">
                  <Link
                    href={`/plataforma/empresas/${t.id}`}
                    className="font-medium text-[#f4efe6] hover:text-[#c4a574]"
                  >
                    {t.nome_operacao}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {t.quantidade_pontos} pts · {t.nichos_ativos.length} nicho(s)
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-300">{t.owner_nome ?? "—"}</p>
                  <p className="text-[11px] text-slate-600">{t.owner_email ?? "—"}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    {SAUDE_LABEL[t.saude] ?? t.saude}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-400">
                  {t.pontos_count}p · {t.equipamentos_count}m · {t.equipe_count}u
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#e8d5b0]">
                  {money(t.mrr_estimado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlataformaShell>
  );
}
