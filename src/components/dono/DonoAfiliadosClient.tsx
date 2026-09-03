"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Plus, Users } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import { cn } from "@/lib/utils";

type AfiliadoItem = {
  id: string;
  nome: string;
  email: string;
  codigo: string;
  ativo: boolean;
  comissao_tipo: "percentual" | "fixo";
  comissao_valor: number;
  link: string;
  stats?: {
    clicks: number;
    cadastros: number;
    pendente_centavos: number;
    pago_centavos: number;
  };
};

function moneyC(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DonoAfiliadosClient({ email }: { email: string }) {
  const { theme } = useDonoTheme();
  const light = theme === "light";
  const [itens, setItens] = useState<AfiliadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    codigo: "",
    senha: "",
    whatsapp: "",
    comissao_tipo: "percentual" as "percentual" | "fixo",
    comissao_valor: "20",
  });

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-at bg-white/[0.02] p-5";

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch("/api/dono/afiliados", { signal: ctrl.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha.");
      setItens(data.afiliados ?? []);
      if (data.error) setErro(data.error);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setErro("A página demorou demais. Reinicie o npm run dev e rode o SQL de afiliados.");
      } else {
        setErro(e instanceof Error ? e.message : "Erro.");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/afiliados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          comissao_valor: Number(form.comissao_valor),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não criou.");
      setOk(`Parceiro ${data.afiliado.nome} criado. Link pronto.`);
      setShowForm(false);
      setForm({
        nome: "",
        email: "",
        codigo: "",
        senha: "",
        whatsapp: "",
        comissao_tipo: "percentual",
        comissao_valor: "20",
      });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro.");
    } finally {
      setSaving(false);
    }
  }

  async function copiar(link: string) {
    await navigator.clipboard.writeText(link);
    setOk("Link copiado.");
  }

  return (
    <DonoShell
      email={email}
      title="Afiliados"
      subtitle="Quem vende o OperaRoute — link, % ou valor fixo, e comissões."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px]",
              light
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-[#c4a574]/40 bg-[#c4a574]/15 text-at-link"
            )}
          >
            <Plus className="h-4 w-4" />
            Novo afiliado
          </button>
          <p className="text-[12px] text-at-muted">
            Portal do parceiro:{" "}
            <Link href="/parceiro" className="underline hover:text-at-primary/85">
              /parceiro
            </Link>
            · SQL: supabase/plataforma-afiliados.sql
          </p>
        </div>

        {erro && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}
        {ok && (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            {ok}
          </p>
        )}

        {showForm && (
          <form onSubmit={criar} className={cn(card, "grid gap-3 sm:grid-cols-2")}>
            <input
              required
              placeholder="Nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
            />
            <input
              required
              type="email"
              placeholder="E-mail (login no /parceiro)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
            />
            <input
              placeholder="Código do link (ex.: joao)"
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
            />
            <input
              required
              type="password"
              placeholder="Senha do parceiro (mín. 6)"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
            />
            <input
              placeholder="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
            />
            <div className="flex gap-2">
              <select
                value={form.comissao_tipo}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    comissao_tipo: e.target.value as "percentual" | "fixo",
                  }))
                }
                className="rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
              >
                <option value="percentual">% do pagamento</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                placeholder={form.comissao_tipo === "fixo" ? "R$" : "%"}
                value={form.comissao_valor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comissao_valor: e.target.value }))
                }
                className="w-28 rounded-lg border border-at-soft bg-transparent px-3 py-2 text-[13px]"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 rounded-xl border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2.5 text-[13px] text-at-link disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Criar afiliado"}
            </button>
          </form>
        )}

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-at-muted" />
        ) : itens.length === 0 ? (
          <div className={cn(card, "text-[13px] text-at-muted")}>
            <Users className="mb-2 h-5 w-5 opacity-50" />
            Nenhum afiliado ainda. Crie o primeiro e envie o link.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-at">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-at text-[10px] uppercase tracking-wider text-at-muted">
                  <th className="px-4 py-3 font-medium">Parceiro</th>
                  <th className="px-4 py-3 font-medium">Comissão</th>
                  <th className="px-4 py-3 font-medium">Funil</th>
                  <th className="px-4 py-3 font-medium">A receber</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--at-border-soft)]">
                {itens.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dono/afiliados/${a.id}`}
                        className="font-medium text-at-primary hover:text-at-link"
                      >
                        {a.nome}
                      </Link>
                      <p className="text-[11px] text-at-soft">
                        {a.email} · @{a.codigo}
                        {!a.ativo && " · pausado"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-at-muted">
                      {a.comissao_tipo === "fixo"
                        ? moneyC(Math.round(a.comissao_valor * 100))
                        : `${a.comissao_valor}%`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-at-muted">
                      {a.stats?.clicks ?? 0} cliques · {a.stats?.cadastros ?? 0}{" "}
                      cadastros
                    </td>
                    <td className="px-4 py-3 tabular-nums text-at-link">
                      {moneyC(a.stats?.pendente_centavos ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void copiar(a.link)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-at-muted hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DonoShell>
  );
}
