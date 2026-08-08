"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { ChamadoPrioridade } from "@/lib/chamados/types";
import { Wrench, X } from "lucide-react";

type Props = {
  pontoId: string;
  equipamentoId?: string | null;
  equipamentoNome?: string;
  variant?: "button" | "link" | "icon";
  className?: string;
};

export function AbrirChamadoButton({
  pontoId,
  equipamentoId = null,
  equipamentoNome,
  variant = "button",
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [titulo, setTitulo] = useState(
    equipamentoNome ? `Manutenção — ${equipamentoNome}` : "Máquina precisa de manutenção"
  );
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>("media");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function fechar() {
    if (loading) return;
    setOpen(false);
    setError("");
  }

  async function submit() {
    setError("");
    if (!titulo.trim()) {
      setError("Informe um título.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          equipamento_id: equipamentoId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao abrir chamado");
        return;
      }
      setOpen(false);
      setDescricao("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
            onClick={fechar}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="abrir-chamado-titulo"
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md max-h-[min(90dvh,640px)] flex-col overflow-hidden rounded-t-2xl border border-amber-500/20 bg-slate-950 shadow-2xl sm:rounded-xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 shrink-0">
                <div className="min-w-0">
                  <h3 id="abrir-chamado-titulo" className="font-semibold text-white">
                    Abrir chamado de manutenção
                  </h3>
                  {equipamentoNome && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Equipamento: {equipamentoNome}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0 disabled:opacity-50"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0">
                <FormInput
                  label="Título *"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
                <FormTextarea
                  label="O que aconteceu?"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Máquina não liga, visor apagado, claw travado..."
                  rows={3}
                  className="min-h-[88px]"
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as ChamadoPrioridade)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 px-5 py-4 shrink-0 bg-slate-950">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  {loading ? "Abrindo..." : "Abrir chamado"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {variant === "link" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            "text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
          }
        >
          <Wrench className="h-3 w-3" />
          Abrir chamado
        </button>
      ) : variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Abrir chamado de manutenção"
          aria-label="Abrir chamado de manutenção"
          className={
            className ??
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          }
        >
          <Wrench className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            "inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
          }
        >
          <Wrench className="h-3.5 w-3.5" />
          Manutenção
        </button>
      )}

      {modal}
      <LoadingOverlay show={loading} message="Abrindo chamado..." />
    </>
  );
}
