"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Minus, Plus, Package, Store } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { formatCurrency, cn } from "@/lib/utils";
import {
  normalizarEstoqueBrindesPonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";
import type { ProdutoConsignado } from "@/lib/types/database";

type Props = {
  equipamentoId: string;
  estoqueAtual: EstoqueBrindePonto[] | unknown;
  onEstoqueChange?: (estoque: EstoqueBrindePonto[]) => void;
};

export function EquipamentoConsignadoPanel({
  equipamentoId,
  estoqueAtual,
  onEstoqueChange,
}: Props) {
  const router = useRouter();
  const [produtos, setProdutos] = useState<ProdutoConsignado[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const inicial = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of normalizarEstoqueBrindesPonto(estoqueAtual)) {
      if (e.item_id) map.set(e.item_id, Number(e.quantidade) || 0);
    }
    return map;
  }, [estoqueAtual]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCatalogo(true);
      try {
        const res = await fetch("/api/produtos-consignados", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Erro ao carregar produtos.");
          return;
        }
        const items = (data.items ?? []) as ProdutoConsignado[];
        if (cancelled) return;
        setProdutos(items.filter((p) => p.ativo !== false));
        setError("");
      } catch {
        if (!cancelled) setError("Erro ao carregar produtos consignados.");
      } finally {
        if (!cancelled) setLoadingCatalogo(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const out: Record<string, string> = {};
    for (const p of produtos) {
      const q = inicial.get(p.id) ?? 0;
      out[p.id] = q > 0 ? String(q) : "";
    }
    setQuantidades(out);
  }, [produtos, inicial]);

  const totalUnidades = Object.values(quantidades).reduce(
    (acc, v) => acc + Math.max(0, Math.floor(Number(v) || 0)),
    0
  );

  async function salvar() {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const itens = produtos
        .map((p) => ({
          produto_id: p.id,
          quantidade: Math.max(0, Math.floor(Number(quantidades[p.id]) || 0)),
        }))
        .filter((i) => i.quantidade > 0);

      const res = await fetch(`/api/equipamentos/${equipamentoId}/consignado-estoque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar estoque do expositor.");
        return;
      }

      const estoque = (data.estoque_brindes ??
        itens.map((i) => {
          const p = produtos.find((x) => x.id === i.produto_id);
          return {
            item_id: i.produto_id,
            nome: p?.nome ?? "",
            quantidade: i.quantidade,
            custo_unitario: Number(p?.custo_unitario ?? 0),
          };
        })) as EstoqueBrindePonto[];

      onEstoqueChange?.(normalizarEstoqueBrindesPonto(estoque));
      setMsg("Produtos alocados no expositor.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingCatalogo) {
    return <p className="text-sm text-at-muted">Carregando catálogo...</p>;
  }

  if (produtos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-200">
          <Store className="h-4 w-4" />
          <p className="text-sm font-medium">Nenhum produto consignado cadastrado</p>
        </div>
        <p className="text-xs text-at-muted">
          Cadastre os itens com código, custo, valor final e comissão do comércio.
        </p>
        <Link
          href="/produtos-consignados"
          className="inline-flex text-sm text-cyan-400 hover:underline"
        >
          Ir para Produtos consignados
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Produtos neste expositor</p>
          <p className="text-xs text-at-muted mt-0.5">
            Defina quantas unidades de cada produto ficam aqui — igual aos brindes da máquina de
            ursinho.
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 tabular-nums">
          {totalUnidades} un.
        </span>
      </div>

      <div className="space-y-1.5">
        {produtos.map((p) => {
          const q = Math.max(0, Math.floor(Number(quantidades[p.id]) || 0));
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                q > 0
                  ? "border-amber-500/25 bg-amber-500/5"
                  : "border-slate-800 bg-slate-950/30"
              )}
            >
              {p.foto_url ? (
                <ExpandableImage
                  src={p.foto_url}
                  alt={p.nome}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  fullWidth={false}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80">
                  <Package className="h-4 w-4 text-at-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">
                  <span className="mr-1.5 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    {p.codigo?.trim() || "s/ cód."}
                  </span>
                  {p.nome}
                </p>
                <p className="text-[11px] text-at-muted">
                  Custo {formatCurrency(Number(p.custo_unitario ?? 0))} · Final{" "}
                  {formatCurrency(Number(p.preco_venda ?? 0))}
                  {p.comissao_fixa != null
                    ? ` · Comércio ${formatCurrency(Number(p.comissao_fixa))}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setQuantidades((prev) => ({
                      ...prev,
                      [p.id]: String(Math.max(0, q - 1) || ""),
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-at-primary/85 hover:bg-slate-800"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-1.5 text-center text-sm text-white tabular-nums focus:border-amber-500/50 focus:outline-none"
                  inputMode="numeric"
                  placeholder="0"
                  value={quantidades[p.id] ?? ""}
                  onChange={(e) =>
                    setQuantidades((prev) => ({
                      ...prev,
                      [p.id]: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantidades((prev) => ({
                      ...prev,
                      [p.id]: String(q + 1),
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-at-primary/85 hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
        >
          <Gift className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar no expositor"}
        </button>
        <Link
          href="/produtos-consignados"
          className="text-xs text-at-muted hover:text-cyan-400 hover:underline"
        >
          Gerenciar catálogo
        </Link>
      </div>

      {msg && <p className="text-sm text-green-400">{msg}</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
