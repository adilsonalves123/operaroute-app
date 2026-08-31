"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImageIcon, Loader2, Package, Trash2 } from "lucide-react";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { resumirKitNoPonto } from "@/lib/estoque/alocados-pontos";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import { cn } from "@/lib/utils";

type KitOption = {
  id: string;
  nome: string;
  ativo: boolean;
  foto_url?: string | null;
  quantidade_montada?: number;
  reposicao_itens: { nome: string; quantidade: number; foto_url?: string | null }[];
};

type BrindePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

type ReposicaoLinha = {
  nome: string;
  quantidade: number;
  estoque_item_id?: string | null;
};

function fotoDoKit(kit: Pick<KitOption, "foto_url" | "reposicao_itens">): string | null {
  if (kit.foto_url) return kit.foto_url;
  return kit.reposicao_itens.find((r) => r.foto_url)?.foto_url ?? null;
}

type Props = {
  pontoId: string;
  kitAtivoId: string | null;
  kitInstaladoEm: string | null;
  kitAtivoNome?: string | null;
  estoqueBrindes: BrindePonto[];
  kitReposicao?: ReposicaoLinha[];
  fotosPorItemId?: Record<string, string | null>;
};

function KitThumb({
  src,
  nome,
  className = "h-9 w-9",
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
        className={cn("shrink-0 rounded-md object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900",
        className
      )}
      aria-hidden
    >
      <ImageIcon className="h-3.5 w-3.5 text-slate-600" />
    </span>
  );
}

export function PontoKitInstalar({
  pontoId,
  kitAtivoId,
  kitInstaladoEm,
  kitAtivoNome,
  estoqueBrindes,
  kitReposicao = [],
  fotosPorItemId = {},
}: Props) {
  const router = useRouter();
  const [kits, setKits] = useState<KitOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const brindesNoPonto = useMemo(
    () => normalizarEstoqueBrindesPonto(estoqueBrindes),
    [estoqueBrindes]
  );

  const resumoKit = useMemo(
    () => resumirKitNoPonto(estoqueBrindes, kitReposicao),
    [estoqueBrindes, kitReposicao]
  );

  useEffect(() => {
    fetch("/api/fura-kits", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setKits((d.kits ?? []).filter((k: KitOption) => k.ativo)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function instalar() {
    if (!selectedId) {
      setMsg("Selecione um kit.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}/kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kit_id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao instalar kit.");
        return;
      }
      setMsg(
        data.sobras_devolvidas > 0
          ? `Kit "${data.kit_nome}" alocado. ${data.sobras_devolvidas} unidade(s) que sobraram voltaram ao estoque central.`
          : `Kit "${data.kit_nome}" alocado no ponto.`
      );
      router.refresh();
      fetch("/api/fura-kits", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setKits((d.kits ?? []).filter((k: KitOption) => k.ativo)))
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  async function removerItem(item: BrindePonto) {
    const key = item.item_id ?? item.nome;
    if (removendo === key) return;

    const ok = window.confirm(
      `Remover ${item.quantidade}× ${item.nome} deste ponto?\n\nAs unidades voltam ao estoque central.`
    );
    if (!ok) return;

    setRemovendo(key);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}/brindes/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: item.item_id,
          nome: item.nome,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        devolvido?: number;
      };
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao remover item.");
        return;
      }
      setMsg(
        `${item.nome} removido do ponto${data.devolvido ? ` · ${data.devolvido} un. no central` : ""}.`
      );
      router.refresh();
    } finally {
      setRemovendo(null);
    }
  }

  function fotoDoItem(nome: string, itemId?: string): string | null {
    if (itemId && fotosPorItemId[itemId]) return fotosPorItemId[itemId];
    const brinde = brindesNoPonto.find((b) => b.item_id === itemId || b.nome === nome);
    if (brinde?.item_id && fotosPorItemId[brinde.item_id]) {
      return fotosPorItemId[brinde.item_id];
    }
    return null;
  }

  const selected = kits.find((k) => k.id === selectedId);

  return (
    <div className="glass-card p-6 space-y-4 border border-cyan-500/10">
      <div className="flex items-start gap-3">
        <Package className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-white">Kit no ponto</h2>
          <p className="text-xs text-slate-500 mt-1">
            Alocar kit montado no depósito. Veja abaixo o que está no bar e remova item a item se
            precisar — tudo volta ao estoque central.
          </p>
        </div>
      </div>

      {kitAtivoId && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm">
          <span className="text-cyan-300">Kit ativo: </span>
          <span className="text-white font-medium">{kitAtivoNome ?? "—"}</span>
          {kitInstaladoEm && (
            <span className="text-slate-500 text-xs ml-2">
              desde {new Date(kitInstaladoEm).toLocaleDateString("pt-BR")}
            </span>
          )}
          {resumoKit.totalOriginal > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Restante do kit:{" "}
              <span className="font-medium text-cyan-200 tabular-nums">
                {resumoKit.pctRestante}%
              </span>
              {" · "}
              {resumoKit.totalAtual}/{resumoKit.totalOriginal} un.
            </p>
          )}
        </div>
      )}

      {brindesNoPonto.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-white/[0.08] bg-slate-950/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Itens alocados neste ponto ({brindesNoPonto.length})
          </p>
          <ul className="space-y-2">
            {(resumoKit.itens.length > 0 ? resumoKit.itens : brindesNoPonto.map((b) => ({
              nome: b.nome,
              original: 0,
              atual: b.quantidade,
              pct: 100,
            }))).map((item) => {
              const brinde = brindesNoPonto.find(
                (b) => b.nome.trim().toLowerCase() === item.nome.trim().toLowerCase()
              );
              if (!brinde || brinde.quantidade <= 0) return null;
              const foto = fotoDoItem(item.nome, brinde.item_id);
              const key = brinde.item_id ?? brinde.nome;
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/[0.08]">
                    {foto ? (
                      <LazyThumb src={foto} alt={item.nome} className="h-12 w-12" size={96} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <Package className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{item.nome}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {item.atual} un. no ponto
                      {item.original > 0 ? ` · kit tinha ${item.original}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={removendo === key}
                    onClick={() => void removerItem(brinde)}
                    className="shrink-0 rounded-lg p-2 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                    title="Remover do ponto (volta ao central)"
                    aria-label={`Remover ${item.nome} do ponto`}
                  >
                    {removendo === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : kitAtivoId ? (
        <p className="text-xs text-amber-400/90">
          Kit marcado como ativo, mas sem itens no estoque do ponto. Alocar de novo ou repor pelo
          estoque central.
        </p>
      ) : null}

      {kits.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum kit cadastrado.{" "}
          <a href="/estoque/kits" className="text-primary-neon hover:underline">
            Cadastrar e montar kits
          </a>
        </p>
      ) : (
        <>
          <div ref={rootRef} className="relative">
            <label className="text-xs text-slate-500">Kit para alocar / trocar</label>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="listbox"
              className={cn(
                "mt-1 flex w-full items-center gap-2.5 rounded-lg border bg-slate-900/50 px-3 py-2 text-left text-sm text-white transition",
                open
                  ? "border-cyan-500/50 ring-1 ring-cyan-500/20"
                  : "border-slate-700 hover:border-slate-600"
              )}
            >
              {selected ? (
                <KitThumb src={fotoDoKit(selected)} nome={selected.nome} />
              ) : (
                <KitThumb nome="" />
              )}
              <span className={cn("min-w-0 flex-1 truncate", !selected && "text-slate-500")}>
                {selected
                  ? `${selected.nome} (${selected.quantidade_montada ?? 0} no depósito)`
                  : "Selecionar kit..."}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition",
                  open && "rotate-180"
                )}
              />
            </button>

            {open && (
              <ul
                role="listbox"
                className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 py-1 shadow-xl shadow-black/40"
              >
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedId}
                    onClick={() => {
                      setSelectedId("");
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm",
                      !selectedId
                        ? "bg-cyan-500/15 text-cyan-100"
                        : "text-slate-400 hover:bg-white/[0.04]"
                    )}
                  >
                    <KitThumb nome="" />
                    Selecionar kit...
                  </button>
                </li>
                {kits.map((k) => {
                  const semEstoque = (k.quantidade_montada ?? 0) < 1;
                  const ativo = selectedId === k.id;
                  return (
                    <li key={k.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={ativo}
                        disabled={semEstoque}
                        onClick={() => {
                          if (semEstoque) return;
                          setSelectedId(k.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition",
                          semEstoque && "cursor-not-allowed opacity-45",
                          ativo
                            ? "bg-cyan-500/15 text-cyan-100"
                            : "text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <KitThumb src={fotoDoKit(k)} nome={k.nome} />
                        <span className="min-w-0 flex-1 truncate">
                          {k.nome}{" "}
                          <span className="text-slate-500">
                            ({k.quantidade_montada ?? 0} no depósito)
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected && (
            <ul className="text-xs text-slate-400 space-y-1">
              <li className="text-slate-500 uppercase tracking-wide">Itens deste kit (1 un.):</li>
              {selected.reposicao_itens.map((r, i) => (
                <li key={i}>
                  {r.quantidade}× {r.nome}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={instalar}
            disabled={loading || !selectedId || (selected?.quantidade_montada ?? 0) < 1}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
              "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Alocando..." : "Alocar / trocar kit no ponto"}
          </button>
        </>
      )}

      {msg && (
        <p
          className={cn(
            "text-sm",
            msg.includes("Erro") || msg.includes("insuficiente") || msg.includes("Nenhum")
              ? "text-red-400"
              : "text-green-400"
          )}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
