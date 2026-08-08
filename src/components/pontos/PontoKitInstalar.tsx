"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImageIcon, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type KitOption = {
  id: string;
  nome: string;
  ativo: boolean;
  foto_url?: string | null;
  quantidade_montada?: number;
  reposicao_itens: { nome: string; quantidade: number; foto_url?: string | null }[];
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
}: Props) {
  const router = useRouter();
  const [kits, setKits] = useState<KitOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

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

  const selected = kits.find((k) => k.id === selectedId);

  return (
    <div className="glass-card p-6 space-y-4 border border-cyan-500/10">
      <div className="flex items-start gap-3">
        <Package className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-white">Alocar kit no ponto</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ex.: saíram 3 facas e sobraram 2 — ao colocar um kit novo de 5 facas, as 2 que sobraram
            voltam ao estoque central (avulso) e o kit completo entra no bar. Na coleta, dê baixa
            item por item.
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
        </div>
      )}

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
            <label className="text-xs text-slate-500">Kit para alocar no ponto</label>
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
