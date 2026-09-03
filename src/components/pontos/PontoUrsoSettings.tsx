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
  estoqueBrindes: BrindeEstoque[];
  estoqueCentral: EstoqueCentralItem[];
  titulo?: string;
  descricao?: string;
  labelEstoque?: string;
};

export function PontoUrsoSettings({
  pontoId,
  estoqueBrindes,
  estoqueCentral,
  titulo = "Configurações ursinho",
  descricao =
    "Leitura por entrada no visor e estoque de brindes no ponto. Aloque nas máquinas em Equipamentos → detalhes da máquina → Brindes. Na coleta, cada máquina registra o que saiu do estoque dela.",
  labelEstoque = "Brindes no ponto",
}: Props) {
  const router = useRouter();
  const [brindes, setBrindes] = useState<BrindeEstoque[]>(estoqueBrindes.map((b) => ({ ...b })));
  const [selectedItemId, setSelectedItemId] = useState("");
  const [alocarQty, setAlocarQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [brindesAberto, setBrindesAberto] = useState(false);

  useEffect(() => {
    setBrindes(estoqueBrindes.map((b) => ({ ...b })));
  }, [estoqueBrindes]);

  const catalogoDisponivel = estoqueCentral.filter((item) => Number(item.quantidade) > 0);
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

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
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
      <div className="glass-card space-y-5 border border-pink-500/10 p-6">
        <div>
          <h2 className="font-semibold text-white">{titulo}</h2>
          <p className="mt-1 text-xs text-at-muted">
            {descricao}{" "}
            <a href="/estoque" className="text-primary-neon hover:underline">
              Estoque central
            </a>
          </p>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setBrindesAberto((v) => !v)}
            className="-mx-1 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-800/30"
            aria-expanded={brindesAberto}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-at-primary/85">{labelEstoque}</p>
              {!brindesAberto && (
                <p className="mt-0.5 truncate text-xs text-at-muted">
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
            <div className="mt-3 space-y-3">
              {catalogoDisponivel.length === 0 ? (
                <p className="text-xs text-at-muted">
                  Cadastre itens no{" "}
                  <a href="/estoque" className="text-primary-neon hover:underline">
                    estoque central
                  </a>{" "}
                  para alocar aqui.
                </p>
              ) : (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                  <p className="text-xs text-at-muted">Alocar do estoque central</p>
                  <div className="grid items-end gap-2 sm:grid-cols-[1fr_100px_auto]">
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
                      className="inline-flex h-[42px] items-center justify-center gap-1 rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                      className="grid items-end gap-2 rounded-lg border border-slate-800/80 px-3 py-2 sm:grid-cols-[1fr_90px_auto]"
                    >
                      <div>
                        <p className="mb-0.5 text-xs text-at-muted">Item</p>
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
                        onClick={() => setBrindes((prev) => prev.filter((_, j) => j !== i))}
                        className="mb-0.5 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        title="Remover do ponto"
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
          {loading ? "Salvando..." : "Salvar estoque do ponto"}
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

      <LoadingOverlay show={loading} message="Salvando estoque..." />
    </>
  );
}
