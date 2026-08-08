"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus, Trash2, X } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import type { Equipamento } from "@/lib/types/database";

export function EquipamentoExcluirButton({ equipamento }: { equipamento: Equipamento }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nome = getEquipamentoDisplayNome(equipamento);
  const noEstoque = !equipamento.ponto_id;

  async function devolverAoEstoque() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/equipamentos/${equipamento.id}/devolver-estoque`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao devolver ao estoque.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function apagarDeVez() {
    const ok = confirm(
      `Apagar "${nome}" de vez?\n\nIsso remove o equipamento do sistema. Coletas antigas continuam no histórico. Esta ação não pode ser desfeita.`
    );
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao excluir equipamento.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="rounded-md p-2 text-slate-500 transition hover:bg-white/[0.04] hover:text-rose-300/90 disabled:opacity-50"
        title="Remover equipamento"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Remover equipamento</h3>
                <p className="mt-1 text-sm text-slate-400">{nome}</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-300">
              {noEstoque
                ? "Este equipamento já está no estoque. Deseja apagá-lo de vez?"
                : "O que deseja fazer?"}
            </p>

            <div className="mt-4 space-y-2">
              {!noEstoque && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={devolverAoEstoque}
                  className="flex w-full items-center gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-left hover:bg-cyan-500/15 disabled:opacity-60"
                >
                  <PackageMinus className="h-5 w-5 shrink-0 text-cyan-400" />
                  <span>
                    <span className="block text-sm font-medium text-white">
                      Devolver ao estoque
                    </span>
                    <span className="block text-xs text-slate-400">
                      Sai deste ponto e fica disponível para alocar em outro. Brindes voltam ao
                      ponto.
                    </span>
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={apagarDeVez}
                className="flex w-full items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-left hover:bg-red-500/15 disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5 shrink-0 text-red-400" />
                <span>
                  <span className="block text-sm font-medium text-white">Apagar de vez</span>
                  <span className="block text-xs text-slate-400">
                    Remove do sistema. Não volta ao estoque.
                  </span>
                </span>
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <LoadingOverlay
        show={loading}
        messages={["Atualizando equipamento...", "Quase lá..."]}
      />
    </>
  );
}
