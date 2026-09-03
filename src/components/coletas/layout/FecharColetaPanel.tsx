"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { coletaInputClass } from "./coleta-form-styles";

export function FecharColetaPanel({
  empty,
  resumo,
  previa,
  observacao,
  observacaoValue,
  onObservacaoChange,
  error,
  depoisDaColeta,
  submitLabel,
  submitDisabled,
  loading,
  accent = "gold",
  title = "Fechar coleta",
  subtitle = "Resultado e próximo passo",
  className,
}: {
  empty?: React.ReactNode;
  resumo?: React.ReactNode;
  previa?: React.ReactNode;
  observacao?: boolean;
  observacaoValue?: string;
  onObservacaoChange?: (value: string) => void;
  error?: string | null;
  /** Continuar / Receber / Finalizar — fica logo acima do botão. */
  depoisDaColeta?: React.ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  loading?: boolean;
  accent?: "pink" | "cyan" | "amber" | "emerald" | "red" | "gold";
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  // Evita POST nativo na página (HTTP 405) se o usuário tocar Salvar antes do JS hidratar.
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    setPronto(true);
  }, []);
  const borderAccent =
    accent === "pink"
      ? "border-pink-500/20"
      : accent === "amber"
        ? "border-amber-500/20"
        : accent === "emerald"
          ? "border-emerald-500/20"
          : accent === "red"
            ? "border-red-500/25"
            : accent === "gold"
            ? "border-[#c4a574]/25"
            : "border-primary-neon/20";

  const btnAccent =
    accent === "red"
      ? "bg-red-400 text-slate-950 hover:bg-red-300"
      : "bg-[#c4a574] text-[#0a0e16] hover:bg-[#d4b584]";

  return (
    <aside className={cn("xl:sticky xl:top-20", className)}>
      <div
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-2xl border bg-[#0c1018]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm",
          borderAccent
        )}
      >
        <div className="border-b border-at px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-0.5 text-xs leading-snug text-at-muted">{subtitle}</p>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {empty}
          {resumo}

          {previa && <div className="space-y-2">{previa}</div>}

          {observacao && (
            <details className="group rounded-xl border border-at bg-white/[0.02]">
              <summary className="cursor-pointer list-none px-3.5 py-3 text-sm text-at-muted marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  <span>Observação (opcional)</span>
                  <span className="text-[11px] text-at-soft group-open:hidden">Abrir</span>
                </span>
              </summary>
              <div className="border-t border-at px-3.5 pb-3.5 pt-3">
                <textarea
                  value={observacaoValue ?? ""}
                  onChange={(e) => onObservacaoChange?.(e.target.value)}
                  rows={2}
                  className={coletaInputClass()}
                  placeholder="Anotação interna da coleta..."
                />
              </div>
            </details>
          )}

          {error && (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-at bg-black/20 px-4 py-3.5 sm:px-5">
          {depoisDaColeta}
          <button
            type="button"
            disabled={!pronto || submitDisabled || loading}
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form) {
                if (typeof form.requestSubmit === "function") form.requestSubmit();
                else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
              }
            }}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition disabled:opacity-50",
              btnAccent
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!pronto ? "Carregando…" : submitLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
