"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gift, ImageIcon, Plus, Trash2 } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { cn, formatCurrency } from "@/lib/utils";
import type { AlocacaoBrindeCadastro, AlocacaoBrindeItem } from "@/lib/equipamentos";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";

type EstoqueCentralItem = {
  id: string;
  nome_item: string;
  custo_unitario: number;
  quantidade: number;
  foto_url?: string | null;
};

type CatalogOpt = {
  key: string;
  item_id: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
  source: "ponto" | "central";
  foto_url: string | null;
};

type KitOption = {
  id: string;
  nome: string;
  ativo: boolean;
  foto_url?: string | null;
  quantidade_montada?: number;
  reposicao_itens?: {
    estoque_item_id: string | null;
    nome: string;
    quantidade: number;
  }[];
};

type Props = {
  value: AlocacaoBrindeCadastro | undefined;
  onChange: (value: AlocacaoBrindeCadastro) => void;
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: EstoqueCentralItem[];
  /** Só aloca na máquina (bolinha) — kit vai para a máquina, não fica pool no ponto. */
  estoquePorMaquina?: boolean;
};

function ProdutoFoto({
  src,
  nome,
  className = "h-12 w-12",
}: {
  src?: string | null;
  nome: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nome}
        className={cn("shrink-0 rounded-lg object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900",
        className
      )}
    >
      <ImageIcon className="h-4 w-4 text-at-soft" />
    </div>
  );
}

export function AlocarBrindeCadastroEquipamento({
  value,
  onChange,
  estoqueBrindesPonto = [],
  estoqueCentral = [],
  estoquePorMaquina = false,
}: Props) {
  const modo = value?.modo ?? "nenhum";
  const itens: AlocacaoBrindeItem[] = value?.modo === "avulso" ? value.itens : [];

  const [draftItemKey, setDraftItemKey] = useState("");
  const [draftQty, setDraftQty] = useState("");
  const [kits, setKits] = useState<KitOption[]>([]);
  const [kitsLoading, setKitsLoading] = useState(false);

  useEffect(() => {
    if (modo !== "kit") return;
    setKitsLoading(true);
    fetch("/api/fura-kits", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setKits(
          ((d.kits ?? []) as KitOption[]).filter(
            (k) => k.ativo && (k.quantidade_montada ?? 0) > 0
          )
        );
      })
      .catch(() => setKits([]))
      .finally(() => setKitsLoading(false));
  }, [modo]);

  const fotosPorId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const c of estoqueCentral) map.set(c.id, c.foto_url ?? null);
    return map;
  }, [estoqueCentral]);

  const catalogo = useMemo(() => {
    const opts: CatalogOpt[] = [];

    if (!estoquePorMaquina) {
      for (const b of estoqueBrindesPonto) {
        if (!b.item_id || b.quantidade <= 0) continue;
        opts.push({
          key: `ponto-${b.item_id}`,
          item_id: b.item_id,
          nome: b.nome,
          quantidade: b.quantidade,
          custo_unitario: Number(b.custo_unitario ?? 0),
          source: "ponto",
          foto_url: fotosPorId.get(b.item_id) ?? null,
        });
      }
    }

    for (const c of estoqueCentral) {
      if (c.quantidade <= 0) continue;
      opts.push({
        key: `central-${c.id}`,
        item_id: c.id,
        nome: c.nome_item,
        quantidade: c.quantidade,
        custo_unitario: Number(c.custo_unitario ?? 0),
        source: "central",
        foto_url: c.foto_url ?? null,
      });
    }
    return opts;
  }, [estoqueBrindesPonto, estoqueCentral, estoquePorMaquina, fotosPorId]);

  const draftOpt = catalogo.find((o) => o.key === draftItemKey) ?? null;
  const selectedKit =
    value?.modo === "kit" ? kits.find((k) => k.id === value.kit_id) : undefined;

  function setModo(next: "nenhum" | "avulso" | "kit") {
    setDraftItemKey("");
    setDraftQty("");
    if (next === "nenhum") onChange({ modo: "nenhum" });
    else if (next === "avulso") {
      onChange({
        modo: "avulso",
        itens: value?.modo === "avulso" ? value.itens : [],
      });
    } else onChange({ modo: "kit", kit_id: value?.modo === "kit" ? value.kit_id : "" });
  }

  function adicionarLinha() {
    if (!draftOpt) return;
    const qty = parseInt(draftQty.replace(/\D/g, ""), 10) || 0;
    if (qty <= 0 || qty > draftOpt.quantidade) return;

    const jaTem = itens.find(
      (i) => i.item_id === draftOpt.item_id && i.source === draftOpt.source
    );
    const nextItens = jaTem
      ? itens.map((i) =>
          i.item_id === draftOpt.item_id && i.source === draftOpt.source
            ? {
                ...i,
                quantidade: Math.min(draftOpt.quantidade, i.quantidade + qty),
              }
            : i
        )
      : [
          ...itens,
          {
            source: draftOpt.source,
            item_id: draftOpt.item_id,
            quantidade: qty,
          },
        ];

    onChange({ modo: "avulso", itens: nextItens });
    setDraftItemKey("");
    setDraftQty("");
  }

  function removerLinha(itemId: string, source: "ponto" | "central") {
    const next = itens.filter((i) => !(i.item_id === itemId && i.source === source));
    onChange(next.length ? { modo: "avulso", itens: next } : { modo: "avulso", itens: [] });
  }

  const modos = [
    { id: "nenhum" as const, label: "Depois" },
    { id: "avulso" as const, label: "Avulso" },
    { id: "kit" as const, label: "Kit" },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary-neon" />
        <p className="text-sm font-medium text-white">Alocar brindes</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {modos.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setModo(opt.id)}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-medium transition",
              modo === opt.id
                ? "border-primary-neon/50 bg-primary-neon/10 text-white"
                : "border-slate-700 text-at-muted hover:border-slate-600"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {modo === "avulso" && (
        <div className="space-y-3">
          {itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((linha) => {
                const opt = catalogo.find(
                  (o) => o.item_id === linha.item_id && o.source === linha.source
                );
                return (
                  <li
                    key={`${linha.source}-${linha.item_id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"
                  >
                    <ProdutoFoto
                      src={opt?.foto_url}
                      nome={opt?.nome ?? linha.item_id}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">
                        {opt?.nome ?? linha.item_id}
                      </p>
                      <p className="text-[11px] text-at-muted">
                        {linha.quantidade} un.
                        {opt?.custo_unitario
                          ? ` · ${formatCurrency(opt.custo_unitario)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerLinha(linha.item_id, linha.source)}
                      className="rounded p-1.5 text-at-muted hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {catalogo.length === 0 ? (
            <p className="text-xs text-at-muted">
              Nenhum produto no estoque.{" "}
              <Link href="/estoque" className="text-primary-neon hover:underline">
                Cadastrar
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-xs text-at-muted">Escolha o produto</p>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {catalogo.map((o) => {
                  const selected = draftItemKey === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setDraftItemKey(o.key)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-2 text-left transition",
                        selected
                          ? "border-primary-neon/50 bg-primary-neon/10"
                          : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
                      )}
                    >
                      <ProdutoFoto src={o.foto_url} nome={o.nome} className="h-14 w-full" />
                      <div className="min-w-0 w-full">
                        <p className="truncate text-xs font-medium text-white">{o.nome}</p>
                        <p className="text-[10px] text-at-muted">
                          {o.quantidade} un.
                          {o.custo_unitario > 0
                            ? ` · ${formatCurrency(o.custo_unitario)}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <FormInput
                    label="Quantidade"
                    inputMode="numeric"
                    value={draftQty}
                    onChange={(e) => setDraftQty(e.target.value.replace(/\D/g, ""))}
                    hint={draftOpt ? `Máx. ${draftOpt.quantidade}` : undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={adicionarLinha}
                  disabled={!draftOpt || !(parseInt(draftQty, 10) > 0)}
                  className="mb-0.5 inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-primary-neon px-3 text-xs font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {modo === "kit" && (
        <div className="space-y-3">
          {kitsLoading ? (
            <p className="text-xs text-at-muted">Carregando kits...</p>
          ) : kits.length === 0 ? (
            <p className="text-xs text-at-muted">
              Nenhum kit montado.{" "}
              <Link href="/estoque/kits" className="text-primary-neon hover:underline">
                Montar kits
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-xs text-at-muted">Escolha o kit</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {kits.map((k) => {
                  const selected = value?.modo === "kit" && value.kit_id === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => onChange({ modo: "kit", kit_id: k.id })}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                        selected
                          ? "border-primary-neon/50 bg-primary-neon/10"
                          : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
                      )}
                    >
                      <ProdutoFoto
                        src={k.foto_url}
                        nome={k.nome}
                        className="h-12 w-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{k.nome}</p>
                        <p className="text-[11px] text-at-muted">
                          {k.quantidade_montada ?? 0} montado
                          {(k.quantidade_montada ?? 0) === 1 ? "" : "s"}
                        </p>
                        {k.reposicao_itens && k.reposicao_itens.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {k.reposicao_itens.map((item, idx) => (
                              <li
                                key={`${item.estoque_item_id ?? item.nome}-${idx}`}
                                className="flex items-center gap-2 text-[11px] text-at-muted"
                              >
                                <ProdutoFoto
                                  src={
                                    item.estoque_item_id
                                      ? fotosPorId.get(item.estoque_item_id)
                                      : null
                                  }
                                  nome={item.nome}
                                  className="h-6 w-6"
                                />
                                {item.quantidade}× {item.nome}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedKit && (
                <p className="text-[11px] text-at-muted">
                  O conteúdo do kit será alocado nesta máquina.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
