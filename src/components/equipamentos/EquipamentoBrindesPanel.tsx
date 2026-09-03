"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Plus, ArrowLeft, ImageIcon, ChevronDown } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { formatCurrency, cn } from "@/lib/utils";
import {
  normalizarEstoqueBrindesPonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";

type EstoqueCentralItem = {
  id: string;
  nome_item: string;
  custo_unitario: number;
  quantidade: number;
  foto_url?: string | null;
};

type CatalogOption = {
  key: string;
  item_id: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
  source: "ponto" | "central";
  foto_url: string | null;
};

type Props = {
  equipamentoId: string;
  estoqueBrindesMaquina: EstoqueBrindePonto[];
  estoqueBrindesPonto: EstoqueBrindePonto[];
  estoqueCentral?: EstoqueCentralItem[];
  onEstoqueMaquinaChange?: (brindes: EstoqueBrindePonto[]) => void;
  /** Bolinha: estoque só na máquina, prioriza central. */
  estoquePorMaquina?: boolean;
  titulo?: string;
};

function BrindeFoto({
  src,
  nome,
  className = "h-14 w-14",
  plain = false,
}: {
  src?: string | null;
  nome: string;
  className?: string;
  plain?: boolean;
}) {
  if (src) {
    if (plain) {
      return (
        <img
          src={src}
          alt={nome}
          className={cn("shrink-0 rounded-lg object-cover", className)}
        />
      );
    }
    return (
      <ExpandableImage
        src={src}
        alt={nome}
        className={cn("shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80",
        className
      )}
    >
      <ImageIcon className="h-5 w-5 text-at-soft" />
    </div>
  );
}

function itemLabel(item: CatalogOption): string {
  const origem = item.source === "ponto" ? "no ponto" : "no central";
  return `${item.nome} (${item.quantidade} un. ${origem})`;
}

function BrindeSelectDropdown({
  itensPonto,
  itensCentral,
  selectedKey,
  selected,
  loading,
  onSelect,
}: {
  itensPonto: CatalogOption[];
  itensCentral: CatalogOption[];
  selectedKey: string;
  selected: CatalogOption | null;
  loading: boolean;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSelect(key: string) {
    onSelect(key);
    setOpen(false);
  }

  function renderOption(item: CatalogOption) {
    const active = selectedKey === item.key;
    return (
      <button
        key={item.key}
        type="button"
        disabled={loading}
        onClick={() => handleSelect(item.key)}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
          active ? "bg-pink-500/15 text-white" : "text-at-primary/90 hover:bg-slate-800"
        )}
      >
        <BrindeFoto src={item.foto_url} nome={item.nome} className="h-9 w-9 rounded-md" plain />
        <span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label className="block text-sm font-medium text-at-primary/85">Item</label>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border bg-slate-900 px-3 py-2.5 text-left text-sm transition",
          open
            ? "border-primary-neon/50 ring-1 ring-primary-neon/25"
            : "border-slate-700 hover:border-slate-600"
        )}
      >
        {selected ? (
          <>
            <BrindeFoto src={selected.foto_url} nome={selected.nome} className="h-9 w-9 rounded-md" plain />
            <span className="min-w-0 flex-1 truncate text-white">{itemLabel(selected)}</span>
          </>
        ) : (
          <span className="flex-1 text-at-muted">Selecione o brinde...</span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-at-muted transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {itensPonto.length > 0 && (
            <div>
              <p className="sticky top-0 border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-at-muted">
                No ponto
              </p>
              {itensPonto.map(renderOption)}
            </div>
          )}
          {itensCentral.length > 0 && (
            <div>
              <p className="sticky top-0 border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-at-muted">
                Estoque central
              </p>
              {itensCentral.map(renderOption)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EquipamentoBrindesPanel({
  equipamentoId,
  estoqueBrindesMaquina,
  estoqueBrindesPonto,
  estoqueCentral = [],
  onEstoqueMaquinaChange,
  estoquePorMaquina = false,
  titulo = "Brindes na máquina",
}: Props) {
  const router = useRouter();
  const [brindesMaquina, setBrindesMaquina] = useState(estoqueBrindesMaquina);
  const [brindesPonto, setBrindesPonto] = useState(estoqueBrindesPonto);
  const [selectedKey, setSelectedKey] = useState("");
  const [alocarQty, setAlocarQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setBrindesMaquina(normalizarEstoqueBrindesPonto(estoqueBrindesMaquina));
  }, [estoqueBrindesMaquina]);

  useEffect(() => {
    setBrindesPonto(normalizarEstoqueBrindesPonto(estoqueBrindesPonto));
  }, [estoqueBrindesPonto]);

  const fotosPorItemId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of estoqueCentral) {
      map.set(item.id, item.foto_url ?? null);
    }
    return map;
  }, [estoqueCentral]);

  const catalogo = useMemo(() => {
    const opts: CatalogOption[] = [];

    if (!estoquePorMaquina) {
      for (const item of brindesPonto) {
        if (!item.item_id || item.quantidade <= 0) continue;
        opts.push({
          key: `ponto-${item.item_id}`,
          item_id: item.item_id,
          nome: item.nome,
          quantidade: item.quantidade,
          custo_unitario: Number(item.custo_unitario ?? 0),
          source: "ponto",
          foto_url: item.item_id ? (fotosPorItemId.get(item.item_id) ?? null) : null,
        });
      }
    }

    for (const item of estoqueCentral) {
      if (Number(item.quantidade) <= 0) continue;
      opts.push({
        key: `central-${item.id}`,
        item_id: item.id,
        nome: item.nome_item,
        quantidade: Number(item.quantidade),
        custo_unitario: Number(item.custo_unitario ?? 0),
        source: "central",
        foto_url: item.foto_url ?? null,
      });
    }

    return opts;
  }, [brindesPonto, estoqueCentral, fotosPorItemId, estoquePorMaquina]);

  const itensPonto = catalogo.filter((item) => item.source === "ponto");
  const itensCentral = catalogo.filter((item) => item.source === "central");
  const selected = catalogo.find((item) => item.key === selectedKey) ?? null;
  const totalNaMaquina = brindesMaquina.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantidade) || 0),
    0
  );

  async function adicionarBrinde() {
    const qty = parseInt(alocarQty, 10) || 0;
    if (!selected) {
      setMsg("Selecione um item.");
      return;
    }
    if (qty <= 0) {
      setMsg("Informe a quantidade.");
      return;
    }
    if (qty > selected.quantidade) {
      setMsg(`Máximo disponível: ${selected.quantidade} un.`);
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const endpoint =
        selected.source === "ponto"
          ? `/api/equipamentos/${equipamentoId}/brindes/alocar`
          : `/api/equipamentos/${equipamentoId}/brindes/alocar-central`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_id: selected.item_id, quantidade: qty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao adicionar.");
        return;
      }

      const novoMaquina = normalizarEstoqueBrindesPonto(data.estoque_brindes);
      setBrindesMaquina(novoMaquina);
      onEstoqueMaquinaChange?.(novoMaquina);

      if (selected.source === "ponto") {
        setBrindesPonto((prev) => {
          const next = prev.map((item) => ({ ...item }));
          const idx = next.findIndex((item) => item.item_id === selected.item_id);
          if (idx >= 0) {
            next[idx].quantidade = Math.max(0, next[idx].quantidade - qty);
          }
          return next;
        });
      }

      setSelectedKey("");
      setAlocarQty("");
      setMsg("Brinde adicionado na máquina!");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function devolver(itemId: string, qty: number) {
    if (qty <= 0) return;

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/equipamentos/${equipamentoId}/brindes/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_id: itemId, quantidade: qty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao devolver.");
        return;
      }

      const novoMaquina = normalizarEstoqueBrindesPonto(data.estoque_brindes);
      setBrindesMaquina(novoMaquina);
      onEstoqueMaquinaChange?.(novoMaquina);
      setBrindesPonto((prev) => {
        const next = prev.map((item) => ({ ...item }));
        const brinde = brindesMaquina.find((b) => b.item_id === itemId);
        const idx = next.findIndex((item) => item.item_id === itemId);
        if (idx >= 0) {
          next[idx].quantidade += qty;
        } else if (brinde) {
          next.push({
            item_id: brinde.item_id,
            nome: brinde.nome,
            quantidade: qty,
            custo_unitario: brinde.custo_unitario,
          });
        }
        return next;
      });
      setMsg("Devolvido ao ponto.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={cn(
        "rounded-xl border p-4 space-y-4",
        estoquePorMaquina
          ? "border-orange-500/20 bg-orange-500/5"
          : "border-pink-500/20 bg-pink-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift
            className={cn(
              "h-4 w-4",
              estoquePorMaquina ? "text-orange-300" : "text-pink-300"
            )}
          />
          <div>
            <h4 className="font-medium text-white">{titulo}</h4>
            <p className="text-xs text-at-muted mt-0.5">
              {estoquePorMaquina
                ? "Só esta máquina. Escolha a cápsula/brinde no estoque central (ex.: cápsula R$ 2,00)."
                : "Abra a lista para escolher o brinde. Pode vir do ponto ou do estoque central."}
            </p>
          </div>
        </div>
        <span className="text-xs text-at-muted tabular-nums shrink-0">
          {totalNaMaquina} un. total
        </span>
      </div>

      {catalogo.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center space-y-2">
          <p className="text-sm text-at-muted">Nenhum item disponível para alocar.</p>
          <p className="text-xs text-at-muted">
            Cadastre {estoquePorMaquina ? "cápsulas/brindes" : "brindes"} no{" "}
            <Link href="/estoque" className="text-primary-neon hover:underline">
              estoque central
            </Link>
            {estoquePorMaquina
              ? " (ex.: cápsula R$ 2,00) e volte aqui para colocar nesta máquina."
              : " ou aloque no ponto em Configurações ursinho."}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "space-y-3 rounded-lg border bg-slate-950/50 p-4",
            estoquePorMaquina ? "border-orange-500/25" : "border-pink-500/25"
          )}
        >
          <p className="text-sm font-medium text-white">
            {estoquePorMaquina ? "Colocar nesta máquina" : "Adicionar brinde"}
          </p>

          <div className="grid items-end gap-2 sm:grid-cols-[1fr_90px_auto]">
            <BrindeSelectDropdown
              itensPonto={itensPonto}
              itensCentral={itensCentral}
              selectedKey={selectedKey}
              selected={selected}
              loading={loading}
              onSelect={setSelectedKey}
            />
            <FormInput
              label="Qtd"
              type="number"
              min={1}
              max={selected?.quantidade}
              value={alocarQty}
              onChange={(e) => setAlocarQty(e.target.value)}
              disabled={loading || !selected}
            />
            <button
              type="button"
              onClick={adicionarBrinde}
              disabled={loading || !selectedKey}
              className={cn(
                "inline-flex h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
                estoquePorMaquina
                  ? "bg-orange-500 hover:bg-orange-400"
                  : "bg-pink-500 hover:bg-pink-400"
              )}
            >
              <Plus className="h-4 w-4" />
              {estoquePorMaquina ? "Colocar" : "Adicionar brinde"}
            </button>
          </div>

          {selected && (
            <p className="text-xs text-at-muted">
              Origem:{" "}
              {selected.source === "ponto" ? "estoque do ponto" : "estoque central"} · máx.{" "}
              {selected.quantidade} un.
            </p>
          )}
        </div>
      )}

      {brindesMaquina.length === 0 ? (
        <p className="text-sm text-at-muted">
          {estoquePorMaquina
            ? "Nenhuma cápsula/brinde nesta máquina ainda."
            : "Nenhum brinde alocado nesta máquina ainda."}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-at-muted uppercase tracking-wide">
            Alocados nesta máquina
          </p>
          {brindesMaquina.map((item) => {
            const foto = item.item_id ? (fotosPorItemId.get(item.item_id) ?? null) : null;
            return (
              <div
                key={item.item_id ?? item.nome}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <BrindeFoto src={foto} nome={item.nome} className="h-12 w-12" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{item.nome}</p>
                    <p className="text-xs text-at-muted">
                      {formatCurrency(Number(item.custo_unitario ?? 0))}/un
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-white tabular-nums">
                    {item.quantidade}{" "}
                    <span className="text-sm font-normal text-at-muted">un.</span>
                  </p>
                  {item.item_id && (
                    <button
                      type="button"
                      onClick={() => devolver(item.item_id!, item.quantidade)}
                      disabled={loading}
                      title="Devolver tudo ao ponto"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-at-primary/85 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Devolver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && (
        <p
          className={cn(
            "text-xs",
            msg.includes("Erro") ||
              msg.includes("Informe") ||
              msg.includes("Selecione") ||
              msg.includes("Máximo")
              ? "text-red-400"
              : "text-green-400"
          )}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
