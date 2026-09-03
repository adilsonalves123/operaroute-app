"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Plus, Trash2, Package, Pencil, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { normalizeFotoParaUpload } from "@/lib/storage/normalize-foto-upload";
import { formatCurrency } from "@/lib/utils";
import type { ProdutoConsignado } from "@/lib/types/database";

type FormState = {
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  custo_unitario: string;
  preco_venda: string;
  comissao_fixa: string;
  quantidade: string;
  fornecedor: string;
};

const emptyForm: FormState = {
  codigo: "",
  nome: "",
  descricao: "",
  categoria: "",
  custo_unitario: "",
  preco_venda: "",
  comissao_fixa: "",
  quantidade: "",
  fornecedor: "",
};

function toNum(v: string): number {
  return Number(String(v).replace(",", ".")) || 0;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-at-soft focus:border-amber-500/50 focus:outline-none";

export function ProdutosConsignadosClient({ items }: { items: ProdutoConsignado[] }) {
  const router = useRouter();
  const galeriaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetFotoLocal() {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(null);
    setFotoPreview(null);
    setRemoveFoto(false);
    if (galeriaInputRef.current) galeriaInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    resetFotoLocal();
    setError("");
    setShowForm(true);
  }

  function openEdit(p: ProdutoConsignado) {
    setEditId(p.id);
    setForm({
      codigo: p.codigo ?? "",
      nome: p.nome,
      descricao: p.descricao ?? "",
      categoria: p.categoria ?? "",
      custo_unitario: p.custo_unitario != null ? String(p.custo_unitario) : "",
      preco_venda: p.preco_venda != null ? String(p.preco_venda) : "",
      comissao_fixa: p.comissao_fixa != null ? String(p.comissao_fixa) : "",
      quantidade: p.quantidade != null ? String(p.quantidade) : "",
      fornecedor: p.fornecedor ?? "",
    });
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(null);
    setFotoPreview(p.foto_url ?? null);
    setRemoveFoto(false);
    setError("");
    setShowForm(true);
  }

  async function handleFotoPick(file: File | null) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    if (!file) {
      setFotoFile(null);
      setFotoPreview(null);
      return;
    }
    try {
      const normalized = await normalizeFotoParaUpload(file);
      setFotoFile(normalized);
      setFotoPreview(URL.createObjectURL(normalized));
      setRemoveFoto(false);
      setError("");
    } catch (err) {
      setFotoFile(null);
      setFotoPreview(null);
      setError(err instanceof Error ? err.message : "Não foi possível usar esta foto.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (!form.codigo.trim()) {
      setError("Informe o código do produto (único, como número de série).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria.trim() || null,
        custo_unitario: toNum(form.custo_unitario),
        preco_venda: toNum(form.preco_venda),
        comissao_fixa: form.comissao_fixa.trim() ? toNum(form.comissao_fixa) : null,
        quantidade: Math.max(0, Math.floor(toNum(form.quantidade))),
        fornecedor: form.fornecedor.trim() || null,
      };
      const url = editId ? `/api/produtos-consignados/${editId}` : "/api/produtos-consignados";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar produto.");
        return;
      }

      const produtoId = editId ?? data.id;
      if (!produtoId) {
        setError("Produto salvo sem id. Atualize a página.");
        return;
      }

      if (fotoFile) {
        const formData = new FormData();
        formData.append("foto", fotoFile, fotoFile.name || "foto.jpg");
        const fotoRes = await fetch(`/api/produtos-consignados/${produtoId}/foto`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const fotoData = await fotoRes.json().catch(() => ({}));
        if (!fotoRes.ok || !(fotoData as { foto_url?: string }).foto_url) {
          setError(
            (fotoData as { error?: string }).error ??
              "Produto salvo, mas a foto não gravou. Edite e tente de novo."
          );
          router.refresh();
          return;
        }
      } else if (removeFoto && editId) {
        const fotoRes = await fetch(`/api/produtos-consignados/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ foto_url: null }),
        });
        if (!fotoRes.ok) {
          const fotoData = await fotoRes.json().catch(() => ({}));
          setError(
            (fotoData as { error?: string }).error ??
              "Produto salvo, mas falhou ao remover a foto."
          );
          router.refresh();
          return;
        }
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      resetFotoLocal();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto do catálogo?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/produtos-consignados/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card space-y-4 border border-amber-500/15 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">
              {editId ? "Editar produto" : "Novo produto"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetFotoLocal();
              }}
              className="rounded-lg p-1.5 text-at-muted hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="mb-1 block text-xs text-at-muted">Foto do produto</label>
            {/* Galeria sem capture — no tablet o capture sozinho quebra a escolha da galeria */}
            <input
              ref={galeriaInputRef}
              type="file"
              accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                void handleFotoPick(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void handleFotoPick(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {fotoPreview && !removeFoto ? (
              <div className="relative inline-block overflow-hidden rounded-xl border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoPreview} alt="Prévia" className="h-28 w-28 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    void handleFotoPick(null);
                    setRemoveFoto(Boolean(editId));
                  }}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 py-5 text-sm text-at-muted hover:border-amber-500/40 hover:text-amber-300"
                >
                  <Camera className="h-5 w-5" />
                  Câmera
                </button>
                <button
                  type="button"
                  onClick={() => galeriaInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 py-5 text-sm text-at-muted hover:border-amber-500/40 hover:text-amber-300"
                >
                  <ImagePlus className="h-5 w-5" />
                  Galeria
                </button>
              </div>
            )}
            {fotoPreview && !removeFoto && (
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-cyan-400 hover:underline"
                >
                  Nova foto (câmera)
                </button>
                <button
                  type="button"
                  onClick={() => galeriaInputRef.current?.click()}
                  className="text-cyan-400 hover:underline"
                >
                  Escolher na galeria
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-at-muted">Código do produto *</label>
              <input
                className={inputClass}
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Único — ex.: 001 ou SKU"
              />
              <p className="mt-1 text-[11px] text-at-muted">
                Como número de série: não pode repetir. Na coleta dá para achar o item por este código.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-at-muted">Nome *</label>
              <input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Fonte 20W"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-at-muted">Descrição</label>
              <input
                className={inputClass}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex.: entrada 110/220, bivolt"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-at-muted">Preço de custo (R$)</label>
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
                placeholder="Quanto você paga"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-at-muted">Valor final (R$)</label>
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.preco_venda}
                onChange={(e) => setForm({ ...form, preco_venda: e.target.value })}
                placeholder="Preço ao cliente"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-at-muted">
                Quanto o comércio ganha (R$ por unidade)
              </label>
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.comissao_fixa}
                onChange={(e) => setForm({ ...form, comissao_fixa: e.target.value })}
                placeholder="Ex.: 4,00"
              />
              <p className="mt-1 text-[11px] text-at-muted">
                Modo tabela: a cada unidade vendida, o dono fica com este valor. Você recebe
                valor final − comissão.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-at-muted">Estoque central</label>
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-at-muted">Fornecedor</label>
              <input
                className={inputClass}
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
            >
              {loading ? "Salvando..." : editId ? "Salvar alterações" : "Adicionar produto"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetFotoLocal();
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-at-primary/85 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="glass-card border border-dashed border-slate-700 p-8 text-center text-sm text-at-muted">
          Nenhum produto cadastrado ainda. Adicione o primeiro para começar a consignar.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="glass-card flex items-center gap-3 border border-slate-800 p-4"
            >
              {p.foto_url ? (
                <ExpandableImage
                  src={p.foto_url}
                  alt={p.nome}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  fullWidth={false}
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Package className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {p.codigo ? <span className="text-at-muted">[{p.codigo}] </span> : null}
                  {p.nome}
                </p>
                {p.descricao?.trim() && (
                  <p className="truncate text-sm text-at-primary/85 mt-0.5">{p.descricao}</p>
                )}
                <p className="text-xs text-at-muted mt-0.5">
                  Custo {formatCurrency(Number(p.custo_unitario ?? 0))} · Valor final{" "}
                  {formatCurrency(Number(p.preco_venda ?? 0))}
                  {p.comissao_fixa != null
                    ? ` · Comércio ${formatCurrency(Number(p.comissao_fixa))}/un`
                    : ""}
                  {" · "}
                  Estoque {Number(p.quantidade ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="rounded-lg p-2 text-at-muted hover:bg-slate-800 hover:text-white"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="rounded-lg p-2 text-at-muted hover:bg-slate-800 hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
