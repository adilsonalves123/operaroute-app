"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { Ponto } from "@/lib/types/database";
import { cn, formatCurrency } from "@/lib/utils";

type BrindeEstoque = NonNullable<Ponto["estoque_brindes"]>[number];

type EstoqueCentralItem = {
  id: string;
  nome_item: string;
  custo_unitario: number;
  quantidade: number;
};

type Props = {
  pontoId: string;
  precoFuro: number;
  furosEstoque: number | null;
  furosMinimo: number;
  estoqueBrindes: BrindeEstoque[];
  estoqueCentral: EstoqueCentralItem[];
};

export function PontoFuraFuraSettings({
  pontoId,
  precoFuro,
  furosEstoque,
  furosMinimo,
  estoqueBrindes,
  estoqueCentral,
}: Props) {
  const router = useRouter();
  const [preco, setPreco] = useState(String(precoFuro));
  const [furos, setFuros] = useState(furosEstoque != null ? String(furosEstoque) : "");
  const [minimo, setMinimo] = useState(String(furosMinimo));
  const [brindes, setBrindes] = useState<BrindeEstoque[]>(
    estoqueBrindes.map((b) => ({ ...b }))
  );

  useEffect(() => {
    setBrindes(estoqueBrindes.map((b) => ({ ...b })));
  }, [estoqueBrindes]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [alocarQty, setAlocarQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [brindesAberto, setBrindesAberto] = useState(
    estoqueBrindes.some((b) => Number(b.quantidade) > 0)
  );

  const catalogoDisponivel = estoqueCentral.filter((i) => Number(i.quantidade) > 0);
  const brindesComEstoque = brindes.filter((b) => b.quantidade > 0).length;

  async function alocarDoEstoque() {
    const qty = parseInt(alocarQty, 10) || 0;
    if (!selectedItemId) {
      setMsg("Selecione um item do estoque.");
      return;
    }
    if (qty <= 0) {
      setMsg("Informe a quantidade.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/estoque/transferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: selectedItemId,
          ponto_id: pontoId,
          quantidade: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao alocar.");
        return;
      }
      setSelectedItemId("");
      setAlocarQty("");
      setMsg("Brinde alocado!");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function updateBrindeQty(index: number, value: string) {
    setBrindes((prev) =>
      prev.map((b, i) =>
        i === index ? { ...b, quantidade: Math.max(0, Number(value) || 0) } : b
      )
    );
  }

  async function removerBrinde(index: number) {
    const brinde = brindes[index];
    if (!brinde) return;

    const ok = window.confirm(
      `Remover ${brinde.quantidade}× ${brinde.nome} deste ponto?\n\nVolta ao estoque central.`
    );
    if (!ok) return;

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}/brindes/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: brinde.item_id,
          nome: brinde.nome,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao remover.");
        return;
      }
      setBrindes((prev) => prev.filter((_, j) => j !== index));
      setMsg("Item removido do ponto.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          preco_furo: parseFloat(preco) || 1,
          furos_estoque: furos.trim() === "" ? null : Math.max(0, parseInt(furos, 10) || 0),
          furos_minimo: Math.max(0, parseInt(minimo, 10) || 0),
          estoque_brindes: brindes
            .filter((b) => b.nome.trim() && b.quantidade > 0)
            .map((b) => ({
              item_id: b.item_id,
              nome: b.nome.trim(),
              quantidade: b.quantidade,
              custo_unitario: b.custo_unitario ?? 0,
            })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Salvo!");
        router.refresh();
      } else {
        setMsg(data.error ?? "Erro ao salvar");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="glass-card p-6 space-y-5 border border-amber-500/10">
        <div>
          <h2 className="font-semibold text-white">Configurações fura-fura</h2>
          <p className="text-xs text-at-muted mt-1">
            Preço, estoque de furos e brindes alocados neste ponto.{" "}
            <a href="/estoque" className="text-primary-neon hover:underline">
              Estoque central
            </a>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Preço por furo (R$)"
            type="number"
            step="0.01"
            min={0}
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
          <FormInput
            label="Furos no estoque"
            type="number"
            min={0}
            value={furos}
            onChange={(e) => setFuros(e.target.value)}
            hint="Quantidade atual na máquina"
          />
          <FormInput
            label="Furos mínimo (alerta)"
            type="number"
            min={0}
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
            hint="Aviso quando estoque atingir este valor"
          />
        </div>

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setBrindesAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left rounded-lg py-1 hover:bg-slate-800/30 -mx-1 px-1 transition"
            aria-expanded={brindesAberto}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-at-primary/85">Brindes no ponto</p>
              {!brindesAberto && (
                <p className="text-xs text-at-muted mt-0.5 truncate">
                  {brindes.length === 0
                    ? "Nenhum brinde alocado"
                    : `${brindes.length} ${brindes.length === 1 ? "item" : "itens"} · ${brindesComEstoque} com estoque`}
                </p>
              )}
            </div>
            {brindesAberto ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-at-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-at-muted" />
            )}
          </button>

          {brindesAberto && (
            <div className="space-y-3 mt-3">
          {catalogoDisponivel.length === 0 ? (
            <p className="text-xs text-at-muted">
              Cadastre itens no{" "}
              <a href="/estoque" className="text-primary-neon hover:underline">
                estoque central
              </a>{" "}
              para alocar aqui.
            </p>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
              <p className="text-xs text-at-muted">Alocar do estoque central</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto] items-end">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-at-primary/85">Item</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione...</option>
                    {catalogoDisponivel.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_item} ({item.quantidade} no central ·{" "}
                        {formatCurrency(Number(item.custo_unitario))})
                      </option>
                    ))}
                  </select>
                </div>
                <FormInput
                  label="Qtd"
                  type="number"
                  min={1}
                  value={alocarQty}
                  onChange={(e) => setAlocarQty(e.target.value)}
                />
                <button
                  type="button"
                  onClick={alocarDoEstoque}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50 h-[42px]"
                >
                  <Plus className="h-4 w-4" />
                  Alocar
                </button>
              </div>
            </div>
          )}

          {brindes.length === 0 ? (
            <p className="text-xs text-at-soft">Nenhum brinde neste ponto ainda.</p>
          ) : (
            <div className="space-y-2">
              {brindes.map((b, i) => (
                <div
                  key={b.item_id ?? i}
                  className="grid gap-2 sm:grid-cols-[1fr_90px_auto] items-end rounded-lg border border-slate-800/80 px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-at-muted mb-0.5">Item</p>
                    <p className="text-sm font-medium text-white">{b.nome}</p>
                    <p className="text-xs text-at-muted">
                      {formatCurrency(Number(b.custo_unitario ?? 0))}/un
                    </p>
                  </div>
                  <FormInput
                    label="Qtd"
                    type="number"
                    min={0}
                    value={String(b.quantidade)}
                    onChange={(e) => updateBrindeQty(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void removerBrinde(i)}
                    disabled={loading}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 mb-0.5 disabled:opacity-40"
                    title="Remover do ponto (volta ao central)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-at-soft">
                Ajuste a quantidade e clique em Salvar. Para repor do central, use Alocar acima.
              </p>
            </div>
          )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar configurações"}
        </button>
        {msg && (
          <p
            className={cn(
              "text-xs",
              msg === "Salvo!" || msg === "Brinde alocado!" ? "text-green-400" : "text-red-400"
            )}
          >
            {msg}
          </p>
        )}
      </div>

      <LoadingOverlay show={loading} message="Salvando configurações..." />
    </>
  );
}
