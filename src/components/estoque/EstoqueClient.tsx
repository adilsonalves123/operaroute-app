"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatCurrency } from "@/lib/utils";
import type { EstoqueItem, Ponto } from "@/lib/types/database";
import { Package, Plus, Trash2, ArrowRightLeft, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type PontoOption = Pick<Ponto, "id" | "nome">;

type FormState = {
  nome_item: string;
  categoria: string;
  custo_unitario: string;
  quantidade: string;
  quantidade_minima: string;
  fornecedor: string;
  observacao: string;
};

const emptyForm = (): FormState => ({
  nome_item: "",
  categoria: "brinde",
  custo_unitario: "",
  quantidade: "",
  quantidade_minima: "",
  fornecedor: "",
  observacao: "",
});

export function EstoqueClient({
  items: initialItems,
  pontos,
}: {
  items: EstoqueItem[];
  pontos: PontoOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [transferItemId, setTransferItemId] = useState<string | null>(null);
  const [transferPontoId, setTransferPontoId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setMsg("");
  }

  function openEdit(item: EstoqueItem) {
    setEditingId(item.id);
    setForm({
      nome_item: item.nome_item,
      categoria: item.categoria ?? "brinde",
      custo_unitario: String(item.custo_unitario ?? 0),
      quantidade: String(item.quantidade ?? 0),
      quantidade_minima: String(item.quantidade_minima ?? 0),
      fornecedor: item.fornecedor ?? "",
      observacao: item.observacao ?? "",
    });
    setShowForm(true);
    setMsg("");
  }

  async function saveItem() {
    if (!form.nome_item.trim()) {
      setMsg("Informe o nome do item.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const payload = {
        nome_item: form.nome_item.trim(),
        categoria: form.categoria.trim() || "brinde",
        custo_unitario: parseFloat(form.custo_unitario) || 0,
        quantidade: parseInt(form.quantidade, 10) || 0,
        quantidade_minima: parseInt(form.quantidade_minima, 10) || 0,
        fornecedor: form.fornecedor.trim() || null,
        observacao: form.observacao.trim() || null,
      };

      const res = await fetch(editingId ? `/api/estoque/${editingId}` : "/api/estoque", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao salvar.");
        return;
      }
      setShowForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Excluir este item do estoque central?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/estoque/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function transferir() {
    if (!transferItemId || !transferPontoId) {
      setMsg("Selecione item e ponto.");
      return;
    }
    const qty = parseInt(transferQty, 10) || 0;
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
          item_id: transferItemId,
          ponto_id: transferPontoId,
          quantidade: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro na transferência.");
        return;
      }
      setTransferItemId(null);
      setTransferPontoId("");
      setTransferQty("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const totalUnidades = initialItems.reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
  const itensBaixos = initialItems.filter(
    (i) => Number(i.quantidade_minima) > 0 && Number(i.quantidade) <= Number(i.quantidade_minima)
  );

  if (initialItems.length === 0 && !showForm) {
    return (
      <>
        <EmptyState
          title="Estoque vazio"
          description="Cadastre brindes no estoque central e aloque nos pontos fura-fura."
          icon={<Package className="h-8 w-8" />}
        />
        <div className="flex justify-center -mt-8 pb-8">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-primary-neon px-6 py-2.5 text-sm font-semibold text-slate-900"
          >
            Novo item
          </button>
        </div>
        <LoadingOverlay show={loading} message="Salvando..." />
      </>
    );
  }

  function renderForm() {
    return (
      <div className="glass-card p-6 space-y-4 border border-primary-neon/20">
        <h2 className="font-semibold text-white">
          {editingId ? "Editar item" : "Novo item no estoque"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Nome do item"
            value={form.nome_item}
            onChange={(e) => setForm((f) => ({ ...f, nome_item: e.target.value }))}
          />
          <FormInput
            label="Categoria"
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          />
          <FormInput
            label="Custo unitário (R$)"
            type="number"
            step="0.01"
            min={0}
            value={form.custo_unitario}
            onChange={(e) => setForm((f) => ({ ...f, custo_unitario: e.target.value }))}
          />
          <FormInput
            label="Quantidade"
            type="number"
            min={0}
            value={form.quantidade}
            onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
          />
          <FormInput
            label="Quantidade mínima (alerta)"
            type="number"
            min={0}
            value={form.quantidade_minima}
            onChange={(e) => setForm((f) => ({ ...f, quantidade_minima: e.target.value }))}
          />
          <FormInput
            label="Fornecedor"
            value={form.fornecedor}
            onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
          />
        </div>
        <FormInput
          label="Observação"
          value={form.observacao}
          onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveItem}
            disabled={loading}
            className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-slate-400">
              Total: <span className="text-white font-medium">{totalUnidades} un.</span>
            </span>
            {itensBaixos.length > 0 && (
              <span className="text-amber-400">{itensBaixos.length} item(ns) abaixo do mínimo</span>
            )}
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-neon/30 px-4 py-2 text-sm font-medium text-primary-neon hover:bg-primary-neon/10"
          >
            <Plus className="h-4 w-4" />
            Novo item
          </button>
        </div>

        {showForm && renderForm()}

        <div className="space-y-3">
          {initialItems.map((item) => {
            const baixo =
              Number(item.quantidade_minima) > 0 &&
              Number(item.quantidade) <= Number(item.quantidade_minima);
            return (
              <div key={item.id} className="glass-card p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-white">{item.nome_item}</p>
                    {baixo && <AlertBadge variant="warning">Estoque baixo</AlertBadge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.categoria ?? "brinde"} · {formatCurrency(Number(item.custo_unitario))}/un
                    {item.quantidade_minima > 0 && ` · mín. ${item.quantidade_minima}`}
                  </p>
                </div>
                <p className="text-lg font-semibold text-white tabular-nums">
                  {item.quantidade} <span className="text-sm font-normal text-slate-500">un.</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferItemId(item.id);
                      setTransferQty("");
                      setMsg("");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Alocar ponto
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {transferItemId && (
          <div className="glass-card p-5 space-y-4 border border-amber-500/20">
            <h3 className="font-medium text-white text-sm">Alocar brinde para um ponto</h3>
            <p className="text-xs text-slate-500">
              Debita do estoque central e credita em{" "}
              <Link href="/pontos" className="text-primary-neon hover:underline">
                brindes do ponto
              </Link>
              .
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-300">Ponto</label>
                <select
                  value={transferPontoId}
                  onChange={(e) => setTransferPontoId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="">Selecione...</option>
                  {pontos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <FormInput
                label="Quantidade"
                type="number"
                min={1}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
              />
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={transferir}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  Transferir
                </button>
                <button
                  type="button"
                  onClick={() => setTransferItemId(null)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p className={cn("text-sm", msg.includes("Erro") || msg.includes("Informe") ? "text-red-400" : "text-green-400")}>
            {msg}
          </p>
        )}
      </div>

      <LoadingOverlay show={loading} message="Processando..." />
    </>
  );
}
