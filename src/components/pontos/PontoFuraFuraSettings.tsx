"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { Ponto } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type BrindeEstoque = NonNullable<Ponto["estoque_brindes"]>[number];

type Props = {
  pontoId: string;
  precoFuro: number;
  furosEstoque: number | null;
  furosMinimo: number;
  comissaoPercentual: number;
  estoqueBrindes: BrindeEstoque[];
};

export function PontoFuraFuraSettings({
  pontoId,
  precoFuro,
  furosEstoque,
  furosMinimo,
  comissaoPercentual,
  estoqueBrindes,
}: Props) {
  const router = useRouter();
  const [preco, setPreco] = useState(String(precoFuro));
  const [furos, setFuros] = useState(furosEstoque != null ? String(furosEstoque) : "");
  const [minimo, setMinimo] = useState(String(furosMinimo));
  const [comissao, setComissao] = useState(String(comissaoPercentual));
  const [brindes, setBrindes] = useState<BrindeEstoque[]>(
    estoqueBrindes.map((b) => ({ ...b }))
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function addBrinde() {
    setBrindes((prev) => [
      ...prev,
      {
        item_id: crypto.randomUUID(),
        nome: "",
        quantidade: 0,
        custo_unitario: 0,
      },
    ]);
  }

  function updateBrinde(index: number, field: keyof BrindeEstoque, value: string) {
    setBrindes((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        if (field === "nome") return { ...b, nome: value };
        if (field === "quantidade") return { ...b, quantidade: Math.max(0, Number(value) || 0) };
        if (field === "custo_unitario") return { ...b, custo_unitario: Math.max(0, Number(value) || 0) };
        return b;
      })
    );
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
          comissao_percentual: parseFloat(comissao) || 0,
          estoque_brindes: brindes
            .filter((b) => b.nome.trim())
            .map((b) => ({
              item_id: b.item_id ?? crypto.randomUUID(),
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
          <p className="text-xs text-slate-500 mt-1">
            Preço, estoque de furos e brindes alocados neste ponto
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
            label="Comissão do ponto (%)"
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={comissao}
            onChange={(e) => setComissao(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-3 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">Brindes no ponto</p>
            <button
              type="button"
              onClick={addBrinde}
              className="inline-flex items-center gap-1 text-xs text-primary-neon hover:underline"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>
          {brindes.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhum brinde cadastrado neste ponto.</p>
          ) : (
            <div className="space-y-2">
              {brindes.map((b, i) => (
                <div key={b.item_id ?? i} className="grid gap-2 sm:grid-cols-4 items-end">
                  <FormInput
                    label="Nome"
                    value={b.nome}
                    onChange={(e) => updateBrinde(i, "nome", e.target.value)}
                  />
                  <FormInput
                    label="Qtd"
                    type="number"
                    min={0}
                    value={String(b.quantidade)}
                    onChange={(e) => updateBrinde(i, "quantidade", e.target.value)}
                  />
                  <FormInput
                    label="Custo un. (R$)"
                    type="number"
                    step="0.01"
                    min={0}
                    value={String(b.custo_unitario ?? 0)}
                    onChange={(e) => updateBrinde(i, "custo_unitario", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setBrindes((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 mb-0.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
          <p className={cn("text-xs", msg === "Salvo!" ? "text-green-400" : "text-red-400")}>
            {msg}
          </p>
        )}
      </div>

      <LoadingOverlay show={loading} message="Salvando configurações..." />
    </>
  );
}
