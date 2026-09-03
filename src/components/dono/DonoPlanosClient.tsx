"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import {
  MULTIPLICADOR_ANUAL_PADRAO,
  PLANOS_PADRAO,
  type PlanoDefinicao,
} from "@/lib/pricing";
import { cn, formatMoneyInput, parseMoneyInput } from "@/lib/utils";

function clonePlanos(list: PlanoDefinicao[]) {
  return list.map((p) => ({ ...p }));
}

export function DonoPlanosClient({ email }: { email: string }) {
  const { theme } = useDonoTheme();
  const light = theme === "light";

  const [planos, setPlanos] = useState<PlanoDefinicao[]>(() =>
    clonePlanos(PLANOS_PADRAO)
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [multAnual, setMultAnual] = useState(MULTIPLICADOR_ANUAL_PADRAO);
  const [fonte, setFonte] = useState<"banco" | "padrao">("padrao");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/dono/precos");
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao carregar.");
        return;
      }
      setPlanos(clonePlanos(data.planos ?? PLANOS_PADRAO));
      setDrafts({});
      setMultAnual(Number(data.multiplicador_anual) || MULTIPLICADOR_ANUAL_PADRAO);
      setFonte(data.fonte === "banco" ? "banco" : "padrao");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function precoDraft(p: PlanoDefinicao) {
    if (p.slug in drafts) return drafts[p.slug];
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(p.precoMensal);
  }

  function onPrecoChange(slug: string, raw: string) {
    const formatted = formatMoneyInput(raw);
    setDrafts((d) => ({ ...d, [slug]: formatted }));
    const n = parseMoneyInput(formatted);
    setPlanos((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, precoMensal: n } : p))
    );
    setOk("");
  }

  async function salvar() {
    setSaving(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/precos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planos,
          multiplicador_anual: multAnual,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não salvou.");
        return;
      }
      setPlanos(clonePlanos(data.planos));
      setDrafts({});
      setMultAnual(Number(data.multiplicador_anual) || 10);
      setFonte("banco");
      setOk("4 planos salvos. Clientes e MRR usam esses valores agora.");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSaving(false);
    }
  }

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-at bg-white/[0.02] p-5";
  const inputCls = light
    ? "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-stone-400"
    : "w-full rounded-lg border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] outline-none focus:border-[#c4a574]/40";

  return (
    <DonoShell
      email={email}
      title="Planos & preços"
      subtitle="4 planos fixos: pontos + limite de nichos + preço. Anual = mensal × multiplicador."
    >
      {loading && (
        <div className="flex items-center gap-2 text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}
      {erro && (
        <p className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">
          {erro}
        </p>
      )}
      {ok && (
        <p className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">
          {ok}
        </p>
      )}

      {!loading && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void salvar()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50",
                light
                  ? "bg-stone-900 text-white"
                  : "border border-[#c4a574]/40 bg-[#c4a574]/15 text-at-link"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setPlanos(clonePlanos(PLANOS_PADRAO));
                setDrafts({});
                setMultAnual(10);
                setOk("");
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px]",
                light ? "border-stone-200" : "border-at-soft"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </button>
            <label className="ml-auto text-[12px] text-at-muted">
              Anual = mensal ×
              <input
                type="number"
                min={1}
                max={24}
                value={multAnual}
                onChange={(e) => setMultAnual(Number(e.target.value) || 10)}
                className={cn(inputCls, "ml-2 inline-block w-16")}
              />
            </label>
            <span className="text-[12px] text-at-muted">
              Fonte: {fonte === "banco" ? "banco" : "padrão"} — rode
              plataforma-precos.sql se ainda não rodou
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {planos.map((p) => (
              <div key={p.slug} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-at-muted">
                      {p.id}
                    </p>
                    <input
                      value={p.nome}
                      onChange={(e) =>
                        setPlanos((prev) =>
                          prev.map((x) =>
                            x.slug === p.slug
                              ? { ...x, nome: e.target.value }
                              : x
                          )
                        )
                      }
                      className={cn(inputCls, "mt-1 text-[16px] font-medium")}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-at-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(p.destaque)}
                      onChange={(e) =>
                        setPlanos((prev) =>
                          prev.map((x) =>
                            x.slug === p.slug
                              ? { ...x, destaque: e.target.checked }
                              : x
                          )
                        )
                      }
                    />
                    Destaque
                  </label>
                </div>

                <textarea
                  value={p.descricao}
                  onChange={(e) =>
                    setPlanos((prev) =>
                      prev.map((x) =>
                        x.slug === p.slug
                          ? { ...x, descricao: e.target.value }
                          : x
                      )
                    )
                  }
                  rows={2}
                  className={cn(inputCls, "mt-3")}
                />

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[11px] text-at-muted">
                    Preço mensal
                    <input
                      inputMode="decimal"
                      value={precoDraft(p)}
                      onChange={(e) => onPrecoChange(p.slug, e.target.value)}
                      onBlur={() =>
                        setDrafts((d) => {
                          const n = { ...d };
                          delete n[p.slug];
                          return n;
                        })
                      }
                      className={cn(inputCls, "mt-1 tabular-nums")}
                    />
                  </label>
                  <label className="text-[11px] text-at-muted">
                    Limite pontos
                    <input
                      type="number"
                      min={1}
                      value={p.limitePontos === 9999 ? 9999 : p.limitePontos}
                      onChange={(e) =>
                        setPlanos((prev) =>
                          prev.map((x) =>
                            x.slug === p.slug
                              ? {
                                  ...x,
                                  limitePontos: Number(e.target.value) || 1,
                                }
                              : x
                          )
                        )
                      }
                      className={cn(inputCls, "mt-1")}
                    />
                  </label>
                  <label className="text-[11px] text-at-muted">
                    Máx. nichos
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={p.maxNichos}
                      onChange={(e) =>
                        setPlanos((prev) =>
                          prev.map((x) =>
                            x.slug === p.slug
                              ? {
                                  ...x,
                                  maxNichos: Math.min(
                                    6,
                                    Math.max(1, Number(e.target.value) || 1)
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      className={cn(inputCls, "mt-1")}
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-at-muted">
                  Anual:{" "}
                  {(p.precoMensal * multAnual).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </DonoShell>
  );
}
