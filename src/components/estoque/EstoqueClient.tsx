"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { formatCurrency } from "@/lib/utils";
import type { Equipamento, EstoqueItem, Nicho, Ponto } from "@/lib/types/database";
import {
  Package,
  Plus,
  Minus,
  Trash2,
  ArrowRightLeft,
  ImageIcon,
  Wrench,
  Box,
  Gift,
  Store,
  Cpu,
  Gamepad2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FotoItemEstoque } from "@/components/estoque/FotoItemEstoque";
import { normalizeFotoParaUpload } from "@/lib/storage/normalize-foto-upload";
import { EstoqueKitRow, type KitNoEstoqueCentral } from "@/components/estoque/EstoqueKitRow";
import { CadastrarEquipamentoEstoqueForm } from "@/components/equipamentos/CadastrarEquipamentoEstoqueForm";
import { SelectCard } from "@/components/ui/SelectCard";
import {
  isCategoriaPecas,
  labelCategoriaEstoque,
} from "@/lib/estoque/categorias";
import {
  getEquipamentoDisplayNome,
  getEquipamentoTipoLabel,
  type EquipamentoTipo,
} from "@/lib/equipamentos";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-estoque-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-estoque-sans",
});

type EquipamentoEstoqueRow = Pick<
  Equipamento,
  "id" | "nome" | "tipo" | "numero_maquina" | "numero_serie" | "status" | "foto_url" | "ponto_id"
>;

type FiltroEstoque = "todos" | "Brindes" | "Pecas" | "Equipamentos";

function filtroFromCategoriaParam(raw: string | null | undefined): FiltroEstoque {
  const cat = (raw ?? "").toLowerCase();
  if (cat === "pecas" || cat === "peças") return "Pecas";
  if (cat === "brindes") return "Brindes";
  if (cat === "equipamentos" || cat === "maquinas") return "Equipamentos";
  return "todos";
}

function hrefFiltroEstoque(f: FiltroEstoque): string {
  if (f === "Pecas") return "/estoque?categoria=pecas";
  if (f === "Brindes") return "/estoque?categoria=brindes";
  if (f === "Equipamentos") return "/estoque?categoria=equipamentos";
  return "/estoque";
}

type NovoPainel = null | "escolha" | "item";

type PontoOption = Pick<Ponto, "id" | "nome">;

/** Categorias fixas do cadastro — não é texto livre. */
type CategoriaCadastro = "Brindes" | "Consignado" | "Pecas";

type FormState = {
  nome_item: string;
  descricao: string;
  categoria: CategoriaCadastro;
  custo_unitario: string;
  quantidade: string;
  quantidade_minima: string;
  fornecedor: string;
  observacao: string;
  /** Consignado */
  codigo: string;
  preco_venda: string;
  comissao_comercio: string;
};

const emptyForm = (): FormState => ({
  nome_item: "",
  descricao: "",
  categoria: "Brindes",
  custo_unitario: "",
  quantidade: "",
  quantidade_minima: "",
  fornecedor: "",
  observacao: "",
  codigo: "",
  preco_venda: "",
  comissao_comercio: "",
});

function parseMoney(v: string): number {
  return Number(String(v).replace(",", ".")) || 0;
}

export function EstoqueClient({
  items: initialItems,
  kits: initialKits,
  pontos,
  categoriaInicial,
  equipamentosEstoque = [],
  nichosAtivos,
}: {
  items: EstoqueItem[];
  kits: KitNoEstoqueCentral[];
  pontos: PontoOption[];
  /** Abre filtrado (ex.: link vindo de Máquinas) */
  categoriaInicial?: "Pecas" | "Brindes" | "Equipamentos" | null;
  /** Máquinas no depósito central (ponto_id null) */
  equipamentosEstoque?: EquipamentoEstoqueRow[];
  nichosAtivos?: Nicho[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtroCategoria = filtroFromCategoriaParam(
    searchParams.get("categoria") ??
      (categoriaInicial === "Pecas"
        ? "pecas"
        : categoriaInicial === "Brindes"
          ? "brindes"
          : categoriaInicial === "Equipamentos"
            ? "equipamentos"
            : null)
  );
  const [novoPainel, setNovoPainel] = useState<NovoPainel>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [transferItemId, setTransferItemId] = useState<string | null>(null);
  const [transferKitId, setTransferKitId] = useState<string | null>(null);
  const [transferPontoId, setTransferPontoId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const [expandedKitId, setExpandedKitId] = useState<string | null>(null);
  const [items, setItems] = useState(initialItems);
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const editRowRef = useRef<HTMLDivElement | null>(null);
  const novoFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (editingId && editRowRef.current) {
      editRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (novoPainel === "item" && !editingId && novoFormRef.current) {
      novoFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingId, novoPainel]);

  function resetFoto() {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(null);
    setFotoPreview(null);
    setRemoveFoto(false);
  }

  async function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    if (!file) {
      setFotoFile(null);
      setFotoPreview(null);
      setRemoveFoto(true);
      return;
    }
    try {
      const normalized = await normalizeFotoParaUpload(file);
      setFotoFile(normalized);
      setFotoPreview(URL.createObjectURL(normalized));
      setRemoveFoto(false);
      setMsg("");
    } catch (err) {
      setFotoFile(null);
      setFotoPreview(null);
      setMsg(err instanceof Error ? err.message : "Não foi possível usar esta foto.");
    }
  }

  function openNovoMenu() {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      categoria: filtroCategoria === "Pecas" ? "Pecas" : "Brindes",
    });
    resetFoto();
    setNovoPainel(filtroCategoria === "Pecas" ? "item" : "escolha");
    setMsg("");
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      categoria: filtroCategoria === "Pecas" ? "Pecas" : "Brindes",
    });
    resetFoto();
    setNovoPainel("item");
    setMsg("");
  }

  function openMontarKit() {
    router.push("/estoque/kits?novo=1");
  }

  function closeNovoPainel() {
    setNovoPainel(null);
    setEditingId(null);
  }

  function openEdit(item: EstoqueItem) {
    if (editingId === item.id) {
      closeNovoPainel();
      return;
    }
    setTransferItemId(null);
    setTransferKitId(null);
    setExpandedKitId(null);
    setEditingId(item.id);
    const catLabel = labelCategoriaEstoque(item.categoria);
    setForm({
      nome_item: item.nome_item,
      descricao: item.descricao ?? "",
      categoria: catLabel === "Peças" ? "Pecas" : "Brindes",
      custo_unitario: String(item.custo_unitario ?? 0),
      quantidade: String(item.quantidade ?? 0),
      quantidade_minima: String(item.quantidade_minima ?? 0),
      fornecedor: item.fornecedor ?? "",
      observacao: item.observacao ?? "",
      codigo: "",
      preco_venda: "",
      comissao_comercio: "",
    });
    resetFoto();
    setFotoPreview(item.foto_url ?? null);
    setNovoPainel(null);
    setMsg("");
  }

  async function quickAdjustQty(itemId: string, delta: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item || adjustingItemId === itemId) return;

    const current = Math.max(0, Math.floor(Number(item.quantidade ?? 0)));
    const next = Math.max(0, current + delta);
    if (next === current) return;

    setAdjustingItemId(itemId);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantidade: next } : i))
    );
    if (editingId === itemId) {
      setForm((f) => ({ ...f, quantidade: String(next) }));
    }

    try {
      const res = await fetch(`/api/estoque/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantidade: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, quantidade: current } : i))
        );
        if (editingId === itemId) {
          setForm((f) => ({ ...f, quantidade: String(current) }));
        }
        setMsg(data.error ?? "Erro ao atualizar quantidade.");
        return;
      }
      setMsg("");
      router.refresh();
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantidade: current } : i))
      );
      if (editingId === itemId) {
        setForm((f) => ({ ...f, quantidade: String(current) }));
      }
      setMsg("Erro ao atualizar quantidade.");
    } finally {
      setAdjustingItemId(null);
    }
  }

  async function saveItem(options?: { continueCadastro?: boolean }) {
    if (!form.nome_item.trim()) {
      setMsg("Informe o nome do item.");
      return;
    }
    if (form.categoria === "Pecas" && (parseInt(form.quantidade, 10) || 0) <= 0) {
      setMsg("Informe a quantidade em estoque da peça (ex.: 1, 2, 5…).");
      return;
    }
    if (form.categoria === "Consignado" && !editingId) {
      if (!form.codigo.trim()) {
        setMsg("Informe o código do produto (único, como número de série).");
        return;
      }
      if (parseMoney(form.preco_venda) <= 0) {
        setMsg("Informe o valor final (preço de venda ao cliente).");
        return;
      }
      if (parseMoney(form.comissao_comercio) < 0) {
        setMsg("Comissão do comércio inválida.");
        return;
      }
    }

    const continueCadastro = Boolean(options?.continueCadastro && !editingId);
    setLoading(true);
    setMsg("");
    try {
      if (form.categoria === "Consignado" && !editingId) {
        const payload = {
          codigo: form.codigo.trim(),
          nome: form.nome_item.trim(),
          categoria: "Consignado",
          custo_unitario: parseMoney(form.custo_unitario),
          preco_venda: parseMoney(form.preco_venda),
          comissao_fixa: form.comissao_comercio.trim()
            ? parseMoney(form.comissao_comercio)
            : null,
          quantidade: Math.max(0, Math.floor(parseMoney(form.quantidade))),
          fornecedor: form.fornecedor.trim() || null,
          observacao: form.observacao.trim() || form.descricao.trim() || null,
        };

        const res = await fetch("/api/produtos-consignados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setMsg(data.error ?? "Erro ao salvar produto consignado.");
          return;
        }

        if (continueCadastro) {
          setForm((f) => ({
            ...f,
            nome_item: "",
            descricao: "",
            codigo: "",
            observacao: "",
          }));
          setMsg(
            `"${payload.nome}" salvo em Produtos consignados. Cadastre o próximo.`
          );
          router.refresh();
          return;
        }

        closeNovoPainel();
        setMsg(`"${payload.nome}" salvo em Produtos consignados.`);
        router.refresh();
        return;
      }

      const payload = {
        nome_item: form.nome_item.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria === "Pecas" ? "Pecas" : "Brindes",
        custo_unitario: parseMoney(form.custo_unitario),
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

      let data: { error?: string; id?: string; success?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        setMsg("Erro ao salvar: resposta inválida do servidor.");
        return;
      }

      if (!res.ok) {
        setMsg(data.error ?? "Erro ao salvar.");
        return;
      }

      const itemId = editingId ?? data.id;
      if (!itemId) {
        setMsg("Item sem id no retorno. Atualize a página e confira se o cadastro apareceu.");
        return;
      }

      let fotoWarning = "";
      if (fotoFile) {
        try {
          const formData = new FormData();
          formData.append("foto", fotoFile, fotoFile.name || "foto.jpg");
          const fotoRes = await fetch(`/api/estoque/${itemId}/foto`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          const fotoData = (await fotoRes.json().catch(() => ({}))) as {
            error?: string;
            foto_url?: string;
          };
          if (!fotoRes.ok || !fotoData.foto_url) {
            fotoWarning =
              fotoData.error ??
              "Item salvo, mas a foto não gravou. Tente de novo em Trocar foto.";
          } else {
            setFotoPreview(fotoData.foto_url);
            setFotoFile(null);
          }
        } catch (err) {
          fotoWarning =
            err instanceof Error
              ? `Item salvo, mas a foto falhou: ${err.message}`
              : "Item salvo, mas falhou ao enviar a foto.";
        }
      } else if (removeFoto) {
        const fotoRes = await fetch(`/api/estoque/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ foto_url: null }),
        });
        if (!fotoRes.ok) {
          const fotoData = await fotoRes.json().catch(() => ({}));
          fotoWarning =
            (fotoData as { error?: string }).error ??
            "Item salvo, mas falhou ao remover a foto.";
        }
      }

      if (fotoWarning) {
        setMsg(fotoWarning);
        router.refresh();
        return;
      }

      if (continueCadastro) {
        setEditingId(null);
        setNovoPainel("item");
        setRemoveFoto(false);
        setForm((f) => ({
          ...f,
          nome_item: "",
          descricao: "",
          observacao: "",
        }));
        setMsg(`"${payload.nome_item}" salvo. Ajuste o que precisar e cadastre o próximo.`);
        router.refresh();
        return;
      }

      resetFoto();
      closeNovoPainel();
      setMsg(`"${payload.nome_item}" salvo.`);
      router.refresh();
    } catch (err) {
      setMsg(
        err instanceof Error ? `Erro ao salvar: ${err.message}` : "Erro ao salvar. Tente novamente."
      );
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

  async function alocarKitNoPonto() {
    if (!transferKitId || !transferPontoId) {
      setMsg("Selecione o kit e o ponto.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${transferPontoId}/kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kit_id: transferKitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao alocar kit no ponto.");
        return;
      }
      setTransferKitId(null);
      setTransferPontoId("");
      setMsg(`Kit "${data.kit_nome}" alocado no ponto.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const totalUnidades = items.reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
  const totalKits = initialKits.reduce((s, k) => s + (k.quantidade_montada ?? 0), 0);
  const itensBaixos = items.filter(
    (i) => Number(i.quantidade_minima) > 0 && Number(i.quantidade) <= Number(i.quantidade_minima)
  );
  const itemsFiltrados = items.filter((item) => {
    if (filtroCategoria === "Equipamentos") return false;
    if (filtroCategoria === "todos") return true;
    if (filtroCategoria === "Pecas") return isCategoriaPecas(item.categoria);
    return !isCategoriaPecas(item.categoria) && labelCategoriaEstoque(item.categoria) !== "Consignado";
  });
  const mostraKits = filtroCategoria !== "Pecas" && filtroCategoria !== "Equipamentos";
  const totalEquipamentos = equipamentosEstoque.length;

  function renderFormFields() {
    const isConsignado = form.categoria === "Consignado" && !editingId;
    const comissaoNum = parseMoney(form.comissao_comercio);
    const vendaNum = parseMoney(form.preco_venda);
    const custoNum = parseMoney(form.custo_unitario);

    return (
      <>
        {!editingId && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Categoria *</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <SelectCard
                label="Brindes"
                description="Itens para máquinas (facas, pelúcias, etc.)"
                selected={form.categoria === "Brindes"}
                onClick={() => setForm((f) => ({ ...f, categoria: "Brindes" }))}
                icon={<Gift className="h-5 w-5" />}
              />
              <SelectCard
                label="Peças"
                description="Fonte, placa, monitor, noteiro, garra…"
                selected={form.categoria === "Pecas"}
                onClick={() => setForm((f) => ({ ...f, categoria: "Pecas" }))}
                icon={<Cpu className="h-5 w-5" />}
              />
              <SelectCard
                label="Consignado"
                description="Produto no comércio — com código e comissão"
                selected={form.categoria === "Consignado"}
                onClick={() => setForm((f) => ({ ...f, categoria: "Consignado" }))}
                icon={<Store className="h-5 w-5" />}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Nome do item"
            value={form.nome_item}
            onChange={(e) => setForm((f) => ({ ...f, nome_item: e.target.value }))}
            placeholder={
              isConsignado
                ? "Ex.: Chocolate X"
                : form.categoria === "Pecas"
                  ? "Ex.: Fonte 12V, Placa mãe, Noteiro"
                  : "Ex.: Cabo de carregamento"
            }
          />
          {isConsignado ? (
            <FormInput
              label="Código do produto *"
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              placeholder="Único — ex.: 001 ou SKU"
            />
          ) : (
            <div className="hidden sm:block" />
          )}
          <div className="sm:col-span-2">
            <FormInput
              label="Descrição"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder={
                isConsignado
                  ? "Ex.: 50g, sabor morango"
                  : form.categoria === "Pecas"
                    ? "Ex.: Compatível com máquina X, modelo Y"
                    : "Ex.: Tipo C"
              }
            />
          </div>

          {isConsignado ? (
            <>
              <FormInput
                label="Preço de custo (R$)"
                inputMode="decimal"
                value={form.custo_unitario}
                onChange={(e) => setForm((f) => ({ ...f, custo_unitario: e.target.value }))}
                placeholder="Quanto você paga no produto"
              />
              <FormInput
                label="Valor final (R$)"
                inputMode="decimal"
                value={form.preco_venda}
                onChange={(e) => setForm((f) => ({ ...f, preco_venda: e.target.value }))}
                placeholder="Preço na prateleira / ao cliente"
              />
              <div className="sm:col-span-2 space-y-1.5">
                <FormInput
                  label="Quanto o comércio ganha (R$ por unidade vendida)"
                  inputMode="decimal"
                  value={form.comissao_comercio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, comissao_comercio: e.target.value }))
                  }
                  placeholder="Ex.: 4,00"
                />
                <p className="text-xs text-slate-500">
                  Na coleta (modo tabela): cada unidade vendida, o dono do estabelecimento fica
                  com este valor. Você recebe o valor final menos essa comissão.
                  {vendaNum > 0 && comissaoNum >= 0 && (
                    <>
                      {" "}
                      Ex.: vende 1 → comércio{" "}
                      <span className="text-slate-300">{formatCurrency(comissaoNum)}</span>, você{" "}
                      <span className="text-slate-300">
                        {formatCurrency(Math.max(0, vendaNum - comissaoNum))}
                      </span>
                      {custoNum > 0 && (
                        <>
                          {" "}
                          (lucro ~{" "}
                          {formatCurrency(Math.max(0, vendaNum - comissaoNum - custoNum))})
                        </>
                      )}
                      .
                    </>
                  )}
                </p>
              </div>
              <FormInput
                label="Quantidade no estoque"
                type="number"
                min={0}
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
              />
              <FormInput
                label="Fornecedor"
                value={form.fornecedor}
                onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {!isConsignado && (
          <FormInput
            label="Observação"
            value={form.observacao}
            onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
          />
        )}

        {!isConsignado && (
          <FotoItemEstoque preview={fotoPreview} onChange={handleFotoChange} />
        )}

        {isConsignado && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            Produtos consignados ficam em{" "}
            <Link href="/produtos-consignados" className="underline hover:text-amber-100">
              Produtos consignados
            </Link>
            , prontos para colocar no expositor. A comissão do comércio usa o valor acima no
            modo tabela do ponto.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveItem()}
            disabled={loading}
            className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            Salvar
          </button>
          {!editingId && (
            <button
              type="button"
              onClick={() => saveItem({ continueCadastro: true })}
              disabled={loading}
              className="rounded-lg border border-primary-neon/40 bg-primary-neon/10 px-4 py-2 text-sm font-semibold text-primary-neon hover:bg-primary-neon/15 disabled:opacity-50"
            >
              Salvar e continuar
            </button>
          )}
          <button
            type="button"
            onClick={closeNovoPainel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cancelar
          </button>
        </div>
        {!editingId && !isConsignado && (
          <p className="text-xs text-slate-500">
            &quot;Salvar e continuar&quot; mantém categoria, valores, quantidades e foto para o próximo
            cadastro — altere só o que mudar (ex.: nome do item).
          </p>
        )}
        {msg && (
          <p
            className={cn(
              "text-sm",
              msg.includes("Erro") ||
              msg.includes("Informe") ||
              msg.includes("falhou") ||
              msg.includes("não gravou") ||
              msg.includes("Tente de novo") ||
              msg.includes("mime") ||
              msg.includes("supported") ||
              msg.includes("não é suportado") ||
              msg.includes("Não foi possível") ||
              msg.includes("inválida")
                ? "text-red-400"
                : "text-green-400"
            )}
          >
            {msg}
          </p>
        )}
      </>
    );
  }

  function renderForm() {
    return (
      <div
        ref={novoFormRef}
        className="glass-card p-6 space-y-4 border border-primary-neon/20"
      >
        <h2 className="font-semibold text-white">
          {form.categoria === "Consignado"
            ? "Novo produto consignado"
            : form.categoria === "Pecas"
              ? "Nova peça de reparo"
              : "Novo item no estoque"}
        </h2>
        {renderFormFields()}
      </div>
    );
  }

  function renderInlineEditForm() {
    return (
      <div className="w-full space-y-4 border-t border-primary-neon/20 pt-4 mt-3">
        <h3 className="text-sm font-semibold text-primary-neon">Editar item</h3>
        {renderFormFields()}
      </div>
    );
  }

  function renderEscolhaNovo() {
    return (
      <div className="glass-card p-6 space-y-4 border border-primary-neon/20">
        <h2 className="font-semibold text-white">O que deseja fazer?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openCreate}
            className="flex flex-col items-start gap-2 rounded-xl border border-primary-neon/25 bg-primary-neon/5 p-4 text-left hover:bg-primary-neon/10 transition"
          >
            <Box className="h-5 w-5 text-primary-neon" />
            <span className="font-medium text-white">Cadastrar item avulso</span>
            <span className="text-xs text-slate-500">
              Facas, relógios e outros brindes que entram no estoque.
            </span>
          </button>
          <button
            type="button"
            onClick={openMontarKit}
            className="flex flex-col items-start gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-left hover:bg-cyan-500/10 transition sm:col-span-2"
          >
            <Wrench className="h-5 w-5 text-cyan-400" />
            <span className="font-medium text-white">Montar kit</span>
            <span className="text-xs text-slate-500">
              Defina o que entra em cada kit e quantos kits montar (ex.: 5 facas por kit × 10 kits).
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={closeNovoPainel}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          Cancelar
        </button>
      </div>
    );
  }

  const estoqueVazio =
    items.length === 0 &&
    initialKits.length === 0 &&
    equipamentosEstoque.length === 0;

  function shell(body: ReactNode) {
    const cta =
      filtroCategoria === "Equipamentos" ? (
        <CadastrarEquipamentoEstoqueForm nichosAtivos={nichosAtivos} />
      ) : (
        <button
          type="button"
          onClick={openNovoMenu}
          className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/35 bg-[#c4a574]/10 px-4 py-2.5 text-[14px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/15"
        >
          <Plus className="h-4 w-4" />
          Novo item
        </button>
      );

    return (
      <div
        className={cn(
          display.variable,
          sans.variable,
          "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 text-[15px] sm:-mx-6 sm:px-6"
        )}
        style={{ fontFamily: "var(--font-estoque-sans), system-ui, sans-serif" }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 45% at 50% -8%, rgba(196,165,116,0.12), transparent 55%), radial-gradient(ellipse 35% 30% at 90% 20%, rgba(34,211,238,0.05), transparent 50%), linear-gradient(180deg, #06080e 0%, #0a0e16 55%, #07090f 100%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                className="text-[12px] font-medium uppercase text-[#c4a574]/90"
                style={{ letterSpacing: "0.38em" }}
              >
                Operação · Depósito
              </p>
              <h1
                className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-estoque-display), Georgia, serif" }}
              >
                Estoque
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
                Brindes, peças, kits e máquinas no depósito central.
                {!estoqueVazio && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="tabular-nums text-[#f4efe6]/90">
                      {totalUnidades} un. avulsas
                    </span>
                    {totalKits > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="tabular-nums text-cyan-300/90">
                          {totalKits} kit{totalKits === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                    {totalEquipamentos > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="tabular-nums text-cyan-300/90">
                          {totalEquipamentos} máquina
                          {totalEquipamentos === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                    {itensBaixos.length > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="tabular-nums text-amber-300/90">
                          {itensBaixos.length} abaixo do mínimo
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">{cta}</div>
          </header>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/estoque/alocados"
              className="rounded-sm border border-cyan-500/25 px-3 py-1.5 text-[13px] text-cyan-300/90 transition hover:bg-cyan-500/10"
            >
              Nos clientes
            </Link>
            <Link
              href="/estoque/kits"
              className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-[13px] text-slate-400 transition hover:border-white/15 hover:text-[#f4efe6]"
            >
              Kits
            </Link>
            <Link
              href="/equipamentos"
              className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-[13px] text-slate-400 transition hover:border-white/15 hover:text-[#f4efe6]"
            >
              Máquinas
            </Link>
          </div>

          <div className="mt-6 h-px w-full bg-gradient-to-r from-[#c4a574]/50 via-white/10 to-transparent" />

          <div className="mt-8 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: "todos" as const, label: "Todos" },
                { id: "Brindes" as const, label: "Brindes" },
                { id: "Pecas" as const, label: "Peças" },
                { id: "Equipamentos" as const, label: "Equipamentos" },
              ] as const
            ).map((f) => (
              <Link
                key={f.id}
                href={hrefFiltroEstoque(f.id)}
                scroll={false}
                onClick={() => {
                  setNovoPainel(null);
                  setEditingId(null);
                }}
                className={cn(
                  "shrink-0 rounded-sm border px-3.5 py-1.5 text-[13px] transition",
                  filtroCategoria === f.id
                    ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#c4a574]"
                    : "border-white/[0.06] text-slate-500 hover:border-white/12 hover:text-slate-300"
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {filtroCategoria === "Pecas" && (
            <p className="mt-4 rounded-sm border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[13px] text-slate-500">
              Peças de reparo ficam separadas dos brindes e aparecem na conclusão do chamado.
            </p>
          )}

          {filtroCategoria === "Equipamentos" && (
            <p className="mt-4 rounded-sm border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-[13px] text-slate-500">
              Máquinas no depósito (ainda sem ponto). Inventário completo em{" "}
              <Link href="/equipamentos" className="text-cyan-300 hover:underline">
                Máquinas e equipamentos
              </Link>
              .
            </p>
          )}

          <div className="mt-6 space-y-6">{body}</div>
        </div>

        <LoadingOverlay show={loading} message="Processando..." />
      </div>
    );
  }

  if (estoqueVazio && !novoPainel) {
    return shell(
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
        <div className="flex flex-col justify-center border border-white/[0.06] bg-white/[0.02] px-6 py-14 sm:px-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-[#c4a574]/25 bg-[#c4a574]/10">
            <Package className="h-6 w-6 text-[#c4a574]" />
          </div>
          <h2
            className="mt-6 text-[1.75rem] tracking-tight text-[#f4efe6]"
            style={{ fontFamily: "var(--font-estoque-display), Georgia, serif" }}
          >
            Estoque vazio
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-400">
            Cadastre brindes, peças de reparo ou máquinas no depósito central e aloque nos
            pontos quando precisar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openNovoMenu}
              className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/35 bg-[#c4a574]/10 px-4 py-2.5 text-[14px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/15"
            >
              <Plus className="h-4 w-4" />
              Novo item
            </button>
            <CadastrarEquipamentoEstoqueForm nichosAtivos={nichosAtivos} />
          </div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
          {[
            { t: "Cadastrar", d: "Itens avulsos, peças de reparo ou máquinas no depósito." },
            { t: "Montar", d: "Monte kits com a composição certa e deixe prontos no estoque." },
            { t: "Alocar", d: "Envie brindes ou kits para o ponto quando for operar." },
          ].map((step) => (
            <div key={step.t} className="bg-[#0a0e16]/95 px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a574]/80">
                {step.t}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{step.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (estoqueVazio && novoPainel) {
    return shell(
      <>
        {novoPainel === "escolha" && renderEscolhaNovo()}
        {novoPainel === "item" && !editingId && renderForm()}
        {msg && <p className="text-sm text-green-400">{msg}</p>}
      </>
    );
  }

  return shell(
    <>
      {novoPainel === "escolha" && renderEscolhaNovo()}
      {novoPainel === "item" && !editingId && renderForm()}

      {filtroCategoria === "Equipamentos" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-[#f4efe6]">Equipamentos no depósito</h2>
              <span className="text-xs text-slate-500">{totalEquipamentos}</span>
            </div>
            <Link href="/equipamentos" className="text-xs text-[#c4a574] hover:underline">
              Ver todas →
            </Link>
          </div>

          {equipamentosEstoque.length === 0 ? (
            <div className="space-y-3 border border-dashed border-white/[0.08] px-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhuma máquina no depósito central (todas já estão em pontos, ou ainda não
                cadastrou).
              </p>
              <Link
                href="/equipamentos"
                className="inline-flex rounded-sm border border-cyan-500/30 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10"
              >
                Ver todas as máquinas →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {equipamentosEstoque.map((eq) => (
                <div
                  key={eq.id}
                  className="flex flex-wrap items-center gap-4 border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="shrink-0">
                    {eq.foto_url ? (
                      <LazyThumb
                        src={eq.foto_url}
                        alt={getEquipamentoDisplayNome(eq)}
                        className="h-14 w-14 rounded-sm"
                        size={112}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-white/[0.08] bg-slate-900/50 text-slate-600">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium text-[#f4efe6]">
                      {getEquipamentoDisplayNome(eq)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getEquipamentoTipoLabel(eq.tipo as EquipamentoTipo)}
                      {eq.numero_serie?.trim() ? ` · Série ${eq.numero_serie.trim()}` : ""}
                      {" · "}
                      <span
                        className={eq.status === "ativo" ? "text-green-400" : "text-slate-400"}
                      >
                        {eq.status}
                      </span>
                    </p>
                  </div>
                  <Link
                    href="/equipamentos"
                    className="rounded-sm border border-white/[0.1] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]"
                  >
                    Abrir
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-2">
                {filtroCategoria === "Pecas" ? (
                  <Cpu className="h-4 w-4 text-amber-400" />
                ) : (
                  <Box className="h-4 w-4 text-slate-400" />
                )}
                <h2 className="text-sm font-semibold text-[#f4efe6]">
                  {filtroCategoria === "Pecas" ? "Peças de reparo" : "Itens avulsos"}
                </h2>
                <span className="text-xs text-slate-500">
                  {itemsFiltrados.reduce((s, i) => s + Number(i.quantidade ?? 0), 0)} un.
                </span>
              </div>
            </div>

            {itemsFiltrados.length === 0 ? (
              <p className="rounded-sm border border-dashed border-white/[0.08] py-6 text-center text-sm text-slate-500">
                {filtroCategoria === "Pecas"
                  ? "Nenhuma peça cadastrada. Use + Novo item e escolha a categoria Peças."
                  : (
                      <>
                        Nenhum item avulso. Use{" "}
                        <strong className="text-slate-400">+ Novo item</strong> para cadastrar.
                      </>
                    )}
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {itemsFiltrados.map((item) => {
                  const baixo =
                    Number(item.quantidade_minima) > 0 &&
                    Number(item.quantidade) <= Number(item.quantidade_minima);
                  const isEditing = editingId === item.id;
                  const ehPeca = isCategoriaPecas(item.categoria);
                  return (
                    <div
                      key={item.id}
                      ref={isEditing ? editRowRef : undefined}
                      className={cn(
                        "overflow-hidden border border-white/[0.06] bg-white/[0.02] transition",
                        !isEditing && "estoque-item-card",
                        isEditing &&
                          "border-[#c4a574]/30 bg-white/[0.03] ring-1 ring-[#c4a574]/15 lg:col-span-2"
                      )}
                    >
                      <div className="flex w-full items-center gap-2 p-4 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-expanded={isEditing}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-white/[0.08]">
                            {item.foto_url ? (
                              <LazyThumb
                                src={item.foto_url}
                                alt={item.nome_item}
                                className="h-14 w-14"
                                size={112}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-600">
                                {ehPeca ? (
                                  <Cpu className="h-5 w-5" />
                                ) : (
                                  <ImageIcon className="h-5 w-5" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[#f4efe6]">{item.nome_item}</p>
                              {baixo && (
                                <AlertBadge variant="warning">Estoque baixo</AlertBadge>
                              )}
                            </div>
                            {item.descricao?.trim() && (
                              <p className="mt-0.5 truncate text-sm text-slate-300">
                                {item.descricao}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              {labelCategoriaEstoque(item.categoria)} ·{" "}
                              {formatCurrency(Number(item.custo_unitario))}/un
                              {item.quantidade_minima > 0 &&
                                ` · mín. ${item.quantidade_minima}`}
                            </p>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={
                              adjustingItemId === item.id || Number(item.quantidade) <= 0
                            }
                            onClick={() => void quickAdjustQty(item.id, -1)}
                            aria-label={`Diminuir ${item.nome_item}`}
                            className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/[0.08] text-slate-300 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="min-w-[3.25rem] px-1 text-center">
                            <p className="text-lg font-semibold tabular-nums text-[#f4efe6]">
                              {item.quantidade}
                            </p>
                            <p className="text-[10px] leading-3 text-slate-500">un.</p>
                          </div>
                          <button
                            type="button"
                            disabled={adjustingItemId === item.id}
                            onClick={() => void quickAdjustQty(item.id, 1)}
                            aria-label={`Aumentar ${item.nome_item}`}
                            className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/10 text-[#e8d5b0] hover:bg-[#c4a574]/20 disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-expanded={isEditing}
                          aria-label={isEditing ? "Fechar edição" : "Editar item"}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-slate-500 hover:bg-white/[0.04] hover:text-[#c4a574]"
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform",
                              isEditing && "rotate-180 text-[#c4a574]"
                            )}
                          />
                        </button>
                      </div>

                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isEditing ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="overflow-hidden">
                          {isEditing && (
                            <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
                              <div className="flex flex-wrap gap-2">
                                {!ehPeca && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTransferItemId(item.id);
                                      setTransferKitId(null);
                                      setTransferQty("");
                                      setMsg("");
                                    }}
                                    className="inline-flex items-center gap-1 rounded-sm border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                    Alocar ponto
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteItem(item.id)}
                                  className="inline-flex items-center gap-1 rounded-sm border border-rose-500/25 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir
                                </button>
                              </div>
                              {renderInlineEditForm()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {mostraKits && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-[#f4efe6]">Kits no depósito</h2>
                  <span className="text-xs text-slate-500">{totalKits} un. montadas</span>
                </div>
                <Link
                  href="/estoque/kits?novo=1"
                  className="text-xs text-[#c4a574] hover:underline"
                >
                  Montar kit →
                </Link>
              </div>

              {initialKits.length === 0 ? (
                <p className="rounded-sm border border-dashed border-cyan-500/20 py-6 text-center text-sm text-slate-500">
                  Nenhum kit cadastrado.{" "}
                  <Link
                    href="/estoque/kits?novo=1"
                    className="text-[#c4a574] hover:underline"
                  >
                    Montar um kit
                  </Link>{" "}
                  e monte no depósito.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {initialKits.map((kit) => (
                    <div
                      key={kit.id}
                      className={cn(expandedKitId === kit.id && "lg:col-span-2")}
                    >
                      <EstoqueKitRow
                        kit={kit}
                        estoqueQtds={items.map((i) => ({
                          id: i.id,
                          quantidade: Number(i.quantidade) || 0,
                        }))}
                        expanded={expandedKitId === kit.id}
                        onToggle={() => {
                          setExpandedKitId((prev) => (prev === kit.id ? null : kit.id));
                          setEditingId(null);
                          setTransferItemId(null);
                          setNovoPainel(null);
                        }}
                        onAlocar={() => {
                          setTransferKitId(kit.id);
                          setTransferItemId(null);
                          setTransferPontoId("");
                          setMsg("");
                        }}
                        onMsg={(text) => setMsg(text)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {transferKitId && (
        <div className="space-y-4 border border-cyan-500/20 bg-white/[0.02] p-5">
          <h3 className="text-sm font-medium text-[#f4efe6]">Alocar kit no ponto</h3>
          <p className="text-xs text-slate-500">
            1 kit sai do depósito central e os itens vão para o pool do bar.{" "}
            <Link href="/pontos" className="text-[#c4a574] hover:underline">
              Ver pontos
            </Link>
            .
          </p>
          <p className="text-sm text-cyan-300">
            {initialKits.find((k) => k.id === transferKitId)?.nome ?? "Kit"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300">Ponto</label>
              <select
                value={transferPontoId}
                onChange={(e) => setTransferPontoId(e.target.value)}
                className="w-full rounded-sm border border-white/[0.1] bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="">Selecione...</option>
                {pontos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={alocarKitNoPonto}
                disabled={loading}
                className="rounded-sm bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Alocar kit
              </button>
              <button
                type="button"
                onClick={() => setTransferKitId(null)}
                className="rounded-sm border border-white/[0.1] px-3 py-2 text-sm text-slate-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {transferItemId && (
        <div className="space-y-4 border border-amber-500/20 bg-white/[0.02] p-5">
          <h3 className="text-sm font-medium text-[#f4efe6]">Alocar brinde para um ponto</h3>
          <p className="text-xs text-slate-500">
            Debita do estoque central e credita em{" "}
            <Link href="/pontos" className="text-[#c4a574] hover:underline">
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
                className="w-full rounded-sm border border-white/[0.1] bg-slate-900 px-3 py-2 text-sm text-white"
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
                className="rounded-sm bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Transferir
              </button>
              <button
                type="button"
                onClick={() => setTransferItemId(null)}
                className="rounded-sm border border-white/[0.1] px-3 py-2 text-sm text-slate-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={cn(
            "text-sm",
            msg.includes("Erro") ||
              msg.includes("Informe") ||
              msg.includes("falhou") ||
              msg.includes("não")
              ? "text-red-400"
              : "text-green-400"
          )}
        >
          {msg}
        </p>
      )}
    </>
  );
}
