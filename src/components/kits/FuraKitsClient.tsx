"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Minus, Package, Plus, Search, Trash2, X } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { FotoKit } from "@/components/kits/FotoKit";
import { KitDepositoControles } from "@/components/kits/KitDepositoControles";
import { cn, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoKit } from "@/lib/storage/coleta-fotos";
import type { EstoqueItem, FuraKit } from "@/lib/types/database";

type KitCompleto = FuraKit & {
  reposicao_itens: {
    id?: string;
    estoque_item_id: string | null;
    nome: string;
    quantidade: number;
    custo_unitario: number;
  }[];
  premios: {
    id?: string;
    estoque_item_id: string | null;
    nome: string;
    custo_unitario: number;
    ordem: number;
  }[];
  quantidade_montada?: number;
};

type LinhaReposicao = {
  estoque_item_id: string;
  nome: string;
  quantidade: string;
  custo_unitario: string;
};

function fotoDoEstoque(
  estoque: EstoqueItem[],
  estoqueItemId: string | null | undefined
): string | null {
  if (!estoqueItemId) return null;
  return estoque.find((e) => e.id === estoqueItemId)?.foto_url ?? null;
}

/** Quantos kits dá para montar com o estoque atual, dada a receita. */
function kitsPossiveisComEstoque(
  reposicao: { estoque_item_id: string; quantidade: number }[],
  estoque: EstoqueItem[]
): number {
  if (!reposicao.length) return 0;
  const map = new Map(estoque.map((e) => [e.id, Number(e.quantidade) || 0]));
  let max = Infinity;
  for (const linha of reposicao) {
    if (!linha.estoque_item_id) continue;
    const need = Math.max(1, Math.floor(linha.quantidade));
    const disponivel = map.get(linha.estoque_item_id) ?? 0;
    max = Math.min(max, Math.floor(disponivel / need));
  }
  return max === Infinity ? 0 : Math.max(0, max);
}

function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Diminuir"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 text-white hover:bg-white/5 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="min-w-[4.5rem] text-center">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          aria-label={label ?? "Quantidade"}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value) || min);
            onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-full bg-transparent text-center text-3xl font-bold tabular-nums text-white outline-none"
        />
      </div>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function FuraKitsClient({
  kits: initialKits,
  estoque,
}: {
  kits: KitCompleto[];
  estoque: EstoqueItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kits, setKits] = useState(initialKits);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [reposicao, setReposicao] = useState<LinhaReposicao[]>([]);
  /** Quantos kits iguais montar ao salvar (nova receita). */
  const [quantidadeMontar, setQuantidadeMontar] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  /** Painel “montar mais” em kit já existente. */
  const [montarKitId, setMontarKitId] = useState<string | null>(null);
  const [montarQtd, setMontarQtd] = useState(1);
  const [buscaEstoque, setBuscaEstoque] = useState("");

  const estoquePorId = useMemo(() => {
    const map = new Map(estoque.map((e) => [e.id, e]));
    return map;
  }, [estoque]);

  const estoqueFiltrado = useMemo(() => {
    const q = buscaEstoque.trim().toLowerCase();
    if (!q) return estoque;
    return estoque.filter((e) => e.nome_item.toLowerCase().includes(q));
  }, [estoque, buscaEstoque]);

  const receitaNumeros = useMemo(
    () =>
      reposicao
        .filter((r) => r.nome.trim() && r.estoque_item_id)
        .map((r) => ({
          estoque_item_id: r.estoque_item_id,
          nome: r.nome.trim(),
          quantidade: Math.max(1, parseInt(r.quantidade, 10) || 1),
        })),
    [reposicao]
  );

  const maxPossivelNovo = useMemo(
    () => kitsPossiveisComEstoque(receitaNumeros, estoque),
    [receitaNumeros, estoque]
  );

  useEffect(() => {
    setKits(initialKits);
  }, [initialKits]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const eid = await getEmpresaIdForUser(supabase);
      if (eid) setEmpresaId(eid);
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  function resetFoto() {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(null);
    setFotoPreview(null);
    setRemoveFoto(false);
  }

  function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
      setRemoveFoto(false);
    } else {
      setFotoFile(null);
      setFotoPreview(null);
      setRemoveFoto(true);
    }
  }

  function adicionarItem(itemId: string) {
    const item = estoquePorId.get(itemId);
    if (!item) return;
    setReposicao((prev) => {
      const idx = prev.findIndex((r) => r.estoque_item_id === itemId);
      if (idx >= 0) {
        return prev.map((r, i) =>
          i === idx
            ? { ...r, quantidade: String(Math.min(99, (parseInt(r.quantidade, 10) || 1) + 1)) }
            : r
        );
      }
      return [
        ...prev,
        {
          estoque_item_id: item.id,
          nome: item.nome_item,
          quantidade: "1",
          custo_unitario: String(item.custo_unitario ?? 0),
        },
      ];
    });
  }

  function removerUmaUnidade(index: number) {
    setReposicao((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const q = Math.max(0, (parseInt(row.quantidade, 10) || 1) - 1);
      if (q < 1) return prev.filter((_, i) => i !== index);
      return prev.map((r, i) => (i === index ? { ...r, quantidade: String(q) } : r));
    });
  }

  function resetForm() {
    setNome("");
    setDescricao("");
    setReposicao([]);
    setQuantidadeMontar(1);
    setBuscaEstoque("");
    resetFoto();
    setEditingId(null);
    setShowForm(false);
    setMsg("");
  }

  function openNovoForm() {
    setNome("");
    setDescricao("");
    setReposicao([]);
    setQuantidadeMontar(1);
    setBuscaEstoque("");
    resetFoto();
    setEditingId(null);
    setShowForm(true);
    setMsg("");
    setMontarKitId(null);
  }

  useEffect(() => {
    const montarId = searchParams.get("montar");
    if (montarId) {
      setMontarKitId(montarId);
      setMontarQtd(1);
      setShowForm(false);
      router.replace("/estoque/kits", { scroll: false });
      requestAnimationFrame(() => {
        document.getElementById(`kit-${montarId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    if (searchParams.get("novo") !== "1") return;
    openNovoForm();
    router.replace("/estoque/kits", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [searchParams, router]);

  function startEdit(kit: KitCompleto) {
    setEditingId(kit.id);
    setNome(kit.nome);
    setDescricao(kit.descricao ?? "");
    setQuantidadeMontar(1);
    setBuscaEstoque("");
    resetFoto();
    setFotoPreview(kit.foto_url ?? null);
    setReposicao(
      kit.reposicao_itens.length
        ? kit.reposicao_itens.map((r) => ({
            estoque_item_id: r.estoque_item_id ?? "",
            nome: r.nome,
            quantidade: String(r.quantidade),
            custo_unitario: String(r.custo_unitario),
          }))
        : []
    );
    setShowForm(true);
    setMontarKitId(null);
  }

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const linhas = reposicao.filter((r) => r.nome.trim() && r.estoque_item_id);
      if (!nome.trim()) {
        setMsg("Informe o nome do kit.");
        return;
      }
      if (!linhas.length) {
        setMsg("Adicione pelo menos um item no kit.");
        return;
      }

      const qtd = editingId ? 1 : Math.min(999, Math.max(1, Math.floor(quantidadeMontar) || 1));

      const payload: Record<string, unknown> = {
        nome,
        descricao,
        reposicao_itens: linhas.map((r) => ({
          estoque_item_id: r.estoque_item_id || null,
          nome: r.nome.trim(),
          quantidade: Math.max(1, parseInt(r.quantidade, 10) || 1),
          custo_unitario: parseFloat(r.custo_unitario) || 0,
        })),
      };
      if (!editingId) payload.quantidade = qtd;

      const url = editingId ? `/api/fura-kits/${editingId}` : "/api/fura-kits";
      const res = await fetch(url, {
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

      const kitId = editingId ?? data.id;
      if (kitId && empresaId && fotoFile) {
        const supabase = createClient();
        const fotoUrl = await uploadFotoKit(supabase, empresaId, kitId, fotoFile);
        const fotoRes = await fetch(`/api/fura-kits/${kitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ foto_url: fotoUrl }),
        });
        if (!fotoRes.ok) {
          const fotoData = await fotoRes.json();
          setMsg(fotoData.error ?? "Kit salvo, mas falhou ao enviar a foto.");
          return;
        }
      } else if (kitId && removeFoto) {
        const fotoRes = await fetch(`/api/fura-kits/${kitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ foto_url: null }),
        });
        if (!fotoRes.ok) {
          const fotoData = await fotoRes.json();
          setMsg(fotoData.error ?? "Kit salvo, mas falhou ao remover a foto.");
          return;
        }
      }

      const wasEdit = Boolean(editingId);
      const montados = Number(data.quantidade_montada ?? qtd);
      resetForm();
      router.refresh();
      const listRes = await fetch("/api/fura-kits", { credentials: "include" });
      const listData = await listRes.json();
      if (listRes.ok) setKits(listData.kits ?? []);
      setMsg(
        wasEdit
          ? "Kit atualizado. Estoque ajustado."
          : montados === 1
            ? "1 kit montado e pronto no depósito."
            : `${montados} kits montados e prontos no depósito.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmarMontarMais(kit: KitCompleto) {
    const qtd = Math.min(999, Math.max(1, Math.floor(montarQtd) || 1));
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/fura-kits/${kit.id}/montar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantidade: qtd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao montar kits.");
        return;
      }
      setMontarKitId(null);
      setMontarQtd(1);
      router.refresh();
      const listRes = await fetch("/api/fura-kits", { credentials: "include" });
      const listData = await listRes.json();
      if (listRes.ok) setKits(listData.kits ?? []);
      const montados = Number(data.montados ?? qtd);
      setMsg(
        montados === 1
          ? `+1 kit de "${kit.nome}" no depósito.`
          : `+${montados} kits de "${kit.nome}" no depósito.`
      );
    } finally {
      setLoading(false);
    }
  }

  function composicaoVisual(kit: KitCompleto) {
    return kit.reposicao_itens.map((r) => ({
      nome: r.nome,
      quantidade: r.quantidade,
      custo_unitario: r.custo_unitario,
      foto_url: fotoDoEstoque(estoque, r.estoque_item_id),
    }));
  }

  async function toggleAtivo(kit: KitCompleto) {
    const res = await fetch(`/api/fura-kits/${kit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ativo: !kit.ativo }),
    });
    if (res.ok) {
      setKits((prev) =>
        prev.map((k) => (k.id === kit.id ? { ...k, ativo: !k.ativo } : k))
      );
    }
  }

  async function excluirKit(kit: KitCompleto) {
    const noDeposito = kit.quantidade_montada ?? 0;
    const avisoDeposito =
      noDeposito > 0
        ? `\n\nHá ${noDeposito} kit(s) pronto(s) no depósito — serão separados e os itens voltam ao estoque.`
        : "";
    if (
      !confirm(
        `Excluir o kit "${kit.nome}"?\n\nA receita some da lista. Coletas antigas continuam no histórico.${avisoDeposito}`
      )
    ) {
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/fura-kits/${kit.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "Erro ao excluir kit.");
        return;
      }
      const desmontados = Number((data as { desmontados?: number }).desmontados ?? 0);
      setMsg(
        desmontados > 0
          ? `Kit "${kit.nome}" excluído. ${desmontados} kit(s) do depósito voltaram aos itens soltos.`
          : `Kit "${kit.nome}" excluído.`
      );
      if (editingId === kit.id) resetForm();
      if (montarKitId === kit.id) setMontarKitId(null);
      setKits((prev) => prev.filter((k) => k.id !== kit.id));
      router.refresh();
    } catch {
      setMsg("Erro de conexão ao excluir kit.");
    } finally {
      setLoading(false);
    }
  }

  const totalNoKit = reposicao.reduce((s, r) => s + (parseInt(r.quantidade, 10) || 0), 0);
  const qtdSalvar = Math.min(999, Math.max(1, Math.floor(quantidadeMontar) || 1));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/estoque"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-primary-neon"
        >
          <ArrowLeft className="h-4 w-4" />
          Estoque central
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
            Fura-fura
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Kits
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Monte a receita de <span className="text-slate-200">um</span> kit (ex.: 5 facas). Depois
            escolha <span className="text-slate-200">quantos kits</span> montar de uma vez — o
            estoque sai multiplicado.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => openNovoForm()}
            className="inline-flex items-center gap-2 rounded-full bg-primary-neon px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_0_28px_rgba(0,212,255,0.25)]"
          >
            <Plus className="h-4 w-4" />
            Novo kit
          </button>
        )}
      </div>

      {showForm && (
        <div className="overflow-hidden rounded-3xl border border-amber-500/15 bg-slate-950/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingId ? "Editar receita" : "Montar kits"}
              </h2>
              <p className="text-xs text-slate-500">
                {editingId
                  ? "Ajuste o que entra em cada kit. Ao salvar, o depósito é sincronizado."
                  : "Passo 1: o que entra em cada kit. Passo 2: quantos kits iguais montar."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-4">
                <FormInput
                  label="Nome do kit"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Kit Faca"
                />
                <FormTextarea
                  label="Descrição (opcional)"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <FotoKit preview={fotoPreview} onChange={handleFotoChange} />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">
                    Passo 1 · Receita de 1 kit
                  </p>
                  <h3 className="text-sm font-semibold text-white">O que entra em cada kit</h3>
                  <p className="text-xs text-slate-500">
                    {totalNoKit > 0
                      ? `${totalNoKit} peça${totalNoKit === 1 ? "" : "s"} por kit (não é a quantidade de kits)`
                      : "Toque nas fotos abaixo para montar a receita"}
                  </p>
                </div>
              </div>

              {reposicao.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                  Toque nas fotos do estoque para montar a receita.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {reposicao.map((r, i) => {
                    const foto = fotoDoEstoque(estoque, r.estoque_item_id);
                    const q = parseInt(r.quantidade, 10) || 1;
                    return (
                      <div
                        key={`${r.estoque_item_id}-${i}`}
                        className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-500/5"
                      >
                        <div className="relative aspect-square">
                          {foto ? (
                            <LazyThumb
                              src={foto}
                              alt={r.nome}
                              className="aspect-square h-full w-full"
                              size={200}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-600">
                              <Package className="h-8 w-8" />
                            </div>
                          )}
                          <span className="absolute left-2 top-2 rounded-full bg-cyan-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                            ×{q} no kit
                          </span>
                          <button
                            type="button"
                            onClick={() => removerUmaUnidade(i)}
                            className="absolute bottom-2 right-2 rounded-full bg-rose-500/90 p-2 text-white shadow"
                            aria-label="Remover uma unidade"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-xs font-medium text-slate-200">{r.nome}</p>
                          <p className="text-[10px] text-slate-500">
                            {formatCurrency(parseFloat(r.custo_unitario) || 0)} / un.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-white">Adicionar do estoque</h3>
              <p className="mb-3 text-xs text-slate-500">
                Busque e toque na miniatura. Se já estiver no kit, soma +1.
              </p>
              {estoque.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Cadastre itens no estoque primeiro.{" "}
                  <Link href="/estoque" className="text-primary-neon hover:underline">
                    Ir ao estoque
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="search"
                      value={buscaEstoque}
                      onChange={(e) => setBuscaEstoque(e.target.value)}
                      placeholder="Buscar pelo nome…"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                    />
                    {buscaEstoque ? (
                      <button
                        type="button"
                        onClick={() => setBuscaEstoque("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:bg-white/5 hover:text-white"
                        aria-label="Limpar busca"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {estoqueFiltrado.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-700 px-3 py-5 text-center text-sm text-slate-500">
                      Nenhum item com “{buscaEstoque.trim()}”.
                    </p>
                  ) : (
                    <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
                      <div className="flex w-max gap-2 px-1">
                        {estoqueFiltrado.map((e) => {
                          const noKit = reposicao.find((r) => r.estoque_item_id === e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              title={`${e.nome_item} · ${e.quantidade} no estoque`}
                              onClick={() => adicionarItem(e.id)}
                              className={cn(
                                "flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl border p-1 text-center transition",
                                noKit
                                  ? "border-cyan-400/40 bg-cyan-500/10 ring-1 ring-cyan-400/20"
                                  : "border-white/[0.06] bg-slate-900/40 hover:border-cyan-400/30 hover:bg-slate-900/70"
                              )}
                            >
                              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-slate-950">
                                {e.foto_url ? (
                                  <LazyThumb
                                    src={e.foto_url}
                                    alt={e.nome_item}
                                    className="h-12 w-12"
                                    size={96}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-slate-600">
                                    <Package className="h-4 w-4" />
                                  </div>
                                )}
                                <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary-neon text-slate-950">
                                  <Plus className="h-2.5 w-2.5" strokeWidth={3} />
                                </span>
                                {noKit ? (
                                  <span className="absolute left-0 top-0 rounded-full bg-cyan-400 px-1 py-px text-[8px] font-bold leading-none text-slate-950">
                                    ×{noKit.quantidade}
                                  </span>
                                ) : null}
                              </div>
                              <p className="line-clamp-2 w-full text-[9px] font-medium leading-tight text-slate-300">
                                {e.nome_item}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!editingId && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-5 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
                  Passo 2 · Quantidade
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  Quantos kits iguais montar agora?
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Cada um leva a receita do passo 1. Ex.: 5 facas por kit × {qtdSalvar} kits ={" "}
                  {totalNoKit * qtdSalvar} peças saem do estoque.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <QtyStepper
                    value={qtdSalvar}
                    onChange={setQuantidadeMontar}
                    min={1}
                    max={maxPossivelNovo > 0 ? Math.max(1, maxPossivelNovo) : 999}
                    label="Quantidade de kits"
                  />
                  <div className="text-sm text-slate-400">
                    <p>
                      <span className="font-semibold tabular-nums text-white">{qtdSalvar}</span>{" "}
                      kit{qtdSalvar === 1 ? "" : "s"} no depósito
                    </p>
                    {receitaNumeros.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Estoque permite até {maxPossivelNovo} agora
                      </p>
                    )}
                  </div>
                </div>
                {receitaNumeros.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-amber-500/15 pt-3 text-xs text-slate-400">
                    {receitaNumeros.map((r) => (
                      <li key={r.estoque_item_id}>
                        {r.nome}:{" "}
                        <span className="tabular-nums text-slate-200">
                          {r.quantidade} × {qtdSalvar} = {r.quantidade * qtdSalvar}
                        </span>{" "}
                        saem do estoque
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {msg && showForm && <p className="text-sm text-amber-400">{msg}</p>}

            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={loading}
                className="rounded-full bg-primary-neon px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {editingId
                  ? "Salvar receita"
                  : qtdSalvar === 1
                    ? "Montar 1 kit"
                    : `Montar ${qtdSalvar} kits`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-700 px-5 py-2.5 text-sm text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && !showForm && (
        <p
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            msg.includes("Erro") || msg.includes("Faltam") || msg.includes("insuficiente")
              ? "border-rose-500/20 bg-rose-500/5 text-rose-300"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          )}
        >
          {msg}
        </p>
      )}

      <div className="space-y-5">
        {kits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 px-6 py-16 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">Nenhum kit ainda.</p>
            <p className="mt-1 text-sm text-slate-600">
              Ex.: Kit Faca — 5 facas por kit, monte quantos quiser de uma vez.
            </p>
          </div>
        ) : (
          kits.map((kit) => {
            const itens = composicaoVisual(kit);
            const maxMais = kitsPossiveisComEstoque(
              kit.reposicao_itens
                .filter((r) => r.estoque_item_id)
                .map((r) => ({
                  estoque_item_id: r.estoque_item_id as string,
                  quantidade: r.quantidade,
                })),
              estoque
            );
            const aberto = montarKitId === kit.id;
            return (
              <div
                key={kit.id}
                id={`kit-${kit.id}`}
                className={cn(!kit.ativo && "opacity-70")}
              >
                <KitDepositoControles
                  nomeKit={kit.nome}
                  descricao={kit.descricao}
                  fotoUrl={kit.foto_url}
                  noDeposito={kit.quantidade_montada ?? 0}
                  itens={itens}
                  className="rounded-3xl"
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(kit)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMontarKitId(aberto ? null : kit.id);
                          setMontarQtd(1);
                          setShowForm(false);
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10"
                      >
                        Montar mais
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleAtivo(kit)}
                        className="rounded-full px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
                      >
                        {kit.ativo ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void excluirKit(kit)}
                        disabled={loading}
                        className="rounded-full px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </>
                  }
                />
                {aberto && (
                  <div className="mt-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-4 sm:px-5">
                    <p className="text-sm font-medium text-white">
                      Montar mais kits de &ldquo;{kit.nome}&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Usa a mesma receita. Estoque permite até {maxMais} agora.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <QtyStepper
                        value={Math.min(montarQtd, Math.max(1, maxMais || 1))}
                        onChange={setMontarQtd}
                        min={1}
                        max={maxMais > 0 ? maxMais : 1}
                        label="Quantidade a montar"
                      />
                      <button
                        type="button"
                        disabled={loading || maxMais < 1}
                        onClick={() => void confirmarMontarMais(kit)}
                        className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
                      >
                        {montarQtd === 1 ? "Montar 1 kit" : `Montar ${montarQtd} kits`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMontarKitId(null)}
                        className="text-sm text-slate-500 hover:text-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                    {maxMais < 1 && (
                      <p className="mt-3 text-xs text-rose-300">
                        Estoque avulso insuficiente para montar mais deste kit.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <LoadingOverlay
        show={loading}
        messages={["Montando kits...", "Ajustando estoque..."]}
      />
    </div>
  );
}
