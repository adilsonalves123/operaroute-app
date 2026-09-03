"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Store, ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ProdutoConsignado } from "@/lib/types/database";

export type ExpositorItem = {
  id: string;
  nome: string;
  pontoNome: string;
  estoque: { item_id?: string; nome: string; quantidade: number }[];
};

const inputClass =
  "w-14 rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-1.5 text-center text-sm text-white tabular-nums focus:border-amber-500/50 focus:outline-none";

function QtyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, n - 1)))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-at-primary/85 hover:bg-slate-800"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        className={inputClass}
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-at-primary/85 hover:bg-slate-800"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ExpositorCard({
  expositor,
  produtos,
}: {
  expositor: ExpositorItem;
  produtos: ProdutoConsignado[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const inicial = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expositor.estoque) {
      if (e.item_id) map.set(e.item_id, Number(e.quantidade) || 0);
    }
    return map;
  }, [expositor.estoque]);

  const [quantidades, setQuantidades] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of produtos) {
      const q = inicial.get(p.id) ?? 0;
      out[p.id] = q > 0 ? String(q) : "";
    }
    return out;
  });

  const totalUnidades = Object.values(quantidades).reduce(
    (acc, v) => acc + Math.max(0, Math.floor(Number(v) || 0)),
    0
  );

  async function salvar() {
    setSaving(true);
    setMsg("");
    try {
      const itens = produtos
        .map((p) => ({
          produto_id: p.id,
          quantidade: Math.max(0, Math.floor(Number(quantidades[p.id]) || 0)),
        }))
        .filter((i) => i.quantidade > 0);

      const res = await fetch(`/api/equipamentos/${expositor.id}/consignado-estoque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao salvar.");
        return;
      }
      setMsg("Estoque do expositor atualizado.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card border border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{expositor.nome}</p>
          <p className="text-xs text-at-muted">{expositor.pontoNome}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-at-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-at-muted" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800 p-4">
          {produtos.length === 0 ? (
            <p className="text-sm text-at-muted">
              Cadastre produtos no catálogo acima antes de abastecer o expositor.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {produtos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">
                        <span className="mr-1.5 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                          {p.codigo?.trim() || "s/ cód."}
                        </span>
                        {p.nome}
                      </p>
                      <p className="text-[11px] text-at-muted">
                        Venda {formatCurrency(Number(p.preco_venda ?? 0))}
                      </p>
                    </div>
                    <QtyField
                      value={quantidades[p.id] ?? ""}
                      onChange={(v) =>
                        setQuantidades((prev) => ({ ...prev, [p.id]: v }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-at-muted">{totalUnidades} unidades no expositor</p>
                <button
                  type="button"
                  onClick={salvar}
                  disabled={saving}
                  className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar estoque"}
                </button>
              </div>
              {msg && <p className="text-xs text-at-muted">{msg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ExpositoresConsignadoManager({
  expositores,
  produtos,
}: {
  expositores: ExpositorItem[];
  produtos: ProdutoConsignado[];
}) {
  if (expositores.length === 0) {
    return (
      <div className="glass-card border border-dashed border-slate-700 p-6 text-center text-sm text-at-muted">
        Nenhum expositor cadastrado. Crie um equipamento do tipo{" "}
        <span className="text-amber-300">Expositor consignado</span> em um ponto para abastecer.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {expositores.map((exp) => (
        <ExpositorCard key={exp.id} expositor={exp} produtos={produtos} />
      ))}
    </div>
  );
}
