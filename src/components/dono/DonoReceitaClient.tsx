"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Wallet } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import type { ReceitaDashboard, ReceitaPeriodo, PagamentoSaaS } from "@/lib/dono/receita";
import { cn, formatMoneyInput, parseMoneyInput } from "@/lib/utils";

type ClienteRow = {
  id: string;
  nome: string;
  ciclo: "mensal" | "anual";
  saude: string;
  assinatura_ativa: boolean;
  mrr_estimado: number | null;
  preco_ciclo: number | null;
  owner_email: string | null;
};

function moneyCentavos(c: number) {
  return (c / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function money(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DonoReceitaClient({ email }: { email: string }) {
  const [data, setData] = useState<(ReceitaDashboard & { clientes?: ClienteRow[] }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    empresa_id: "",
    ciclo: "mensal" as "mensal" | "anual",
    valor: "",
    pago_em: new Date().toISOString().slice(0, 10),
    observacao: "",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dono/receita");
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Falha ao carregar.");
        return;
      }
      setData(json);
      setErro("");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    try {
      const res = await fetch("/api/dono/receita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "registrar",
          empresa_id: form.empresa_id || null,
          ciclo: form.ciclo,
          valor: parseMoneyInput(form.valor),
          pago_em: form.pago_em,
          observacao: form.observacao || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não registrou.");
        return;
      }
      setShowForm(false);
      setForm((f) => ({ ...f, valor: "", observacao: "" }));
      void carregar();
    } finally {
      setSaving(false);
    }
  }

  async function setCiclo(empresaId: string, ciclo: "mensal" | "anual") {
    const res = await fetch("/api/dono/receita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "ciclo", empresa_id: empresaId, ciclo }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.error ?? "Não alterou o ciclo.");
      return;
    }
    void carregar();
  }

  const maxSerie = Math.max(1, ...(data?.serie_30d.map((d) => d.centavos) ?? [1]));

  return (
    <DonoShell
      email={email}
      title="Receita"
      subtitle="Arrecadação real (dia, semana, mês) e quantos clientes fecharam mensal vs anual."
      wide
    >
      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando arrecadação…
        </div>
      )}

      {erro && (
        <p className="mb-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      {data && !loading && (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[12px] text-slate-500">{data.aviso}</p>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-3.5 py-2 text-[13px] text-[#e8d5b0]"
            >
              <Plus className="h-4 w-4" />
              Registrar pagamento
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={registrar}
              className="grid gap-3 rounded-sm border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <label className="text-[12px] text-slate-400 lg:col-span-2">
                Cliente
                <select
                  value={form.empresa_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const c = data.clientes?.find((x) => x.id === id);
                    setForm((f) => ({
                      ...f,
                      empresa_id: id,
                      ciclo: c?.ciclo ?? f.ciclo,
                      valor:
                        c?.preco_ciclo != null
                          ? formatMoneyInput(String(c.preco_ciclo).replace(".", ","))
                          : f.valor,
                    }));
                  }}
                  className="mt-1 w-full rounded-sm border border-white/10 bg-[#0a0e16] px-3 py-2 text-[13px] text-[#f4efe6]"
                >
                  <option value="">— avulso / sem cliente —</option>
                  {(data.clientes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-slate-400">
                Ciclo
                <select
                  value={form.ciclo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ciclo: e.target.value as "mensal" | "anual",
                    }))
                  }
                  className="mt-1 w-full rounded-sm border border-white/10 bg-[#0a0e16] px-3 py-2 text-[13px] text-[#f4efe6]"
                >
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label className="text-[12px] text-slate-400">
                Valor (R$)
                <input
                  required
                  value={form.valor}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      valor: formatMoneyInput(e.target.value),
                    }))
                  }
                  placeholder="279,00"
                  className="mt-1 w-full rounded-sm border border-white/10 bg-[#0a0e16] px-3 py-2 text-[13px] text-[#f4efe6]"
                />
              </label>
              <label className="text-[12px] text-slate-400">
                Data
                <input
                  type="date"
                  required
                  value={form.pago_em}
                  onChange={(e) => setForm((f) => ({ ...f, pago_em: e.target.value }))}
                  className="mt-1 w-full rounded-sm border border-white/10 bg-[#0a0e16] px-3 py-2 text-[13px] text-[#f4efe6]"
                />
              </label>
              <div className="flex items-end sm:col-span-2 lg:col-span-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2 text-[13px] text-[#e8d5b0] disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Confirmar arrecadação"}
                </button>
              </div>
            </form>
          )}

          <section>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-600">
              <Wallet className="h-3.5 w-3.5" />
              Arrecadação
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PeriodoCard titulo="Hoje" p={data.periodos.hoje} highlight />
              <PeriodoCard titulo="Esta semana" p={data.periodos.semana} />
              <PeriodoCard titulo="Este mês" p={data.periodos.mes} />
              <PeriodoCard titulo="Este ano" p={data.periodos.ano} />
            </div>
          </section>

          <div className="grid gap-px overflow-hidden rounded-sm border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                l: "Fecharam mensal",
                v: String(data.planos.mensal),
                tip: "Clientes no ciclo mensal",
              },
              {
                l: "Fecharam anual",
                v: String(data.planos.anual),
                tip: "Clientes no ciclo anual",
              },
              {
                l: "Ativos pagantes",
                v: String(data.planos.ativos_pagantes),
              },
              {
                l: "MRR (pago)",
                v: moneyCentavos(data.previsto.mrr_centavos),
                tip: "Só quem já pagou",
              },
              {
                l: "ARR (pago)",
                v: moneyCentavos(data.previsto.arr_centavos),
              },
            ].map((c) => (
              <div key={c.l} className="bg-[#080b12] px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {c.l}
                </p>
                <p className="mt-1.5 text-[22px] font-medium tabular-nums text-[#f4efe6]">
                  {c.v}
                </p>
                {c.tip && (
                  <p className="mt-1 text-[10px] text-slate-600">{c.tip}</p>
                )}
              </div>
            ))}
          </div>

          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
              Últimos 30 dias
            </p>
            <div className="flex h-28 items-end gap-0.5 rounded-sm border border-white/[0.07] bg-black/20 px-2 py-2">
              {data.serie_30d.map((d) => (
                <div
                  key={d.dia}
                  title={`${d.dia}: ${moneyCentavos(d.centavos)} (${d.qtd})`}
                  className="group relative flex-1 rounded-sm bg-[#c4a574]/25 transition hover:bg-[#c4a574]/55"
                  style={{
                    height: `${Math.max(4, (d.centavos / maxSerie) * 100)}%`,
                  }}
                />
              ))}
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Pagamentos recentes
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-white/[0.07]">
                {data.recentes.length === 0 && (
                  <li className="px-4 py-8 text-center text-[12px] text-slate-500">
                    Nenhum pagamento ainda. Registre o primeiro acima.
                  </li>
                )}
                {data.recentes.map((p: PagamentoSaaS) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[#f4efe6]">
                        {p.empresa_nome ?? "Avulso"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {p.ciclo} · {when(p.pago_em)}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-[#e8d5b0]">
                      {moneyCentavos(p.valor_centavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                Clientes · ciclo de cobrança
              </p>
              <div className="overflow-x-auto rounded-sm border border-white/[0.07]">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2.5 font-medium">Operação</th>
                      <th className="px-3 py-2.5 font-medium">Ciclo</th>
                      <th className="px-3 py-2.5 font-medium text-right">Preço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(data.clientes ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-white/[0.015]">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/dono/empresas/${c.id}`}
                            className="text-[#f4efe6] hover:text-[#c4a574]"
                          >
                            {c.nome}
                          </Link>
                          <p className="text-[11px] text-slate-600">{c.saude}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            {(["mensal", "anual"] as const).map((ciclo) => (
                              <button
                                key={ciclo}
                                type="button"
                                onClick={() => void setCiclo(c.id, ciclo)}
                                className={cn(
                                  "rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                                  c.ciclo === ciclo
                                    ? "border-[#c4a574]/40 bg-[#c4a574]/15 text-[#e8d5b0]"
                                    : "border-white/10 text-slate-500 hover:text-slate-300"
                                )}
                              >
                                {ciclo}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {money(c.preco_ciclo)}
                          <span className="text-[10px] text-slate-600">
                            {c.ciclo === "anual" ? "/ano" : "/mês"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </DonoShell>
  );
}

function PeriodoCard({
  titulo,
  p,
  highlight,
}: {
  titulo: string;
  p: ReceitaPeriodo;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border px-4 py-4",
        highlight
          ? "border-[#c4a574]/35 bg-[#c4a574]/[0.08]"
          : "border-white/[0.07] bg-white/[0.02]"
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {titulo}
      </p>
      <p className="mt-2 text-[26px] font-medium tabular-nums text-[#f4efe6]">
        {moneyCentavos(p.arrecadado_centavos)}
      </p>
      <p className="mt-2 text-[11px] text-slate-500">
        {p.qtd_pagamentos} pagamento(s)
      </p>
      <div className="mt-3 flex gap-3 text-[11px]">
        <span className="text-slate-400">
          Mensal{" "}
          <span className="tabular-nums text-[#e8d5b0]">
            {moneyCentavos(p.mensal_centavos)}
          </span>
          <span className="text-slate-600"> · {p.qtd_mensal}</span>
        </span>
        <span className="text-slate-400">
          Anual{" "}
          <span className="tabular-nums text-[#e8d5b0]">
            {moneyCentavos(p.anual_centavos)}
          </span>
          <span className="text-slate-600"> · {p.qtd_anual}</span>
        </span>
      </div>
    </div>
  );
}
