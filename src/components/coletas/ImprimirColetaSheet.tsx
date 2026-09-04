"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import {
  FORMATOS_IMPRESSAO,
  type FormatoImpressao,
  finalizarImpressaoOverlay,
  limparImpressaoOverlay,
  prepararOverlayImpressao,
} from "@/lib/coletas/imprimir-relatorio-texto";
import { coletaBtnPrimaryClass } from "@/components/coletas/layout/coleta-form-styles";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  bodyHtml: string;
  formato: FormatoImpressao;
  onFormatoChange: (formato: FormatoImpressao) => void;
  onClose: () => void;
};

export function ImprimirColetaSheet({
  open,
  bodyHtml,
  formato,
  onFormatoChange,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function confirmarImpressao() {
    prepararOverlayImpressao(bodyHtml, formato);
    const ok = finalizarImpressaoOverlay();
    if (!ok) {
      window.alert(
        "Não foi possível abrir a impressão. Feche esta tela, toque em Imprimir agora de novo ou use Compartilhar."
      );
      return;
    }
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imprimir-coleta-titulo"
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-at bg-at-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-at px-4 py-3">
          <div>
            <h2 id="imprimir-coleta-titulo" className="text-base font-semibold text-at-primary">
              Imprimir comprovante
            </h2>
            <p className="text-xs text-at-muted">Escolha o papel e confirme a impressão</p>
          </div>
          <button
            type="button"
            onClick={() => {
              limparImpressaoOverlay();
              onClose();
            }}
            className="rounded-lg p-2 text-at-muted transition hover:bg-at-card-soft hover:text-at-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-at px-4 py-3">
          {FORMATOS_IMPRESSAO.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => onFormatoChange(op.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition",
                formato === op.id
                  ? "border-[var(--at-tab-active-border)] bg-at-tab-active/10 text-at-link"
                  : "border-at bg-at-card-soft text-at-muted hover:border-[var(--at-tab-active-border)]"
              )}
            >
              <span className="block text-sm font-medium">{op.label}</span>
              <span className="block text-[11px] opacity-80">{op.hint}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f4f4f4] p-4">
          <div
            className={cn(
              "mx-auto overflow-hidden rounded border border-[#ddd] bg-white p-3 text-black shadow-sm",
              formato === "termica_58" && "max-w-[58mm] text-[10px] font-mono leading-snug",
              formato === "termica_80" && "max-w-[80mm] text-xs font-mono leading-snug",
              formato === "a4" && "max-w-full text-sm"
            )}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        <div className="space-y-2 border-t border-at bg-at-card-soft px-4 py-3">
          <button
            type="button"
            onClick={confirmarImpressao}
            className={coletaBtnPrimaryClass("w-full touch-manipulation py-3.5")}
          >
            <Printer className="h-4 w-4" />
            Imprimir agora
          </button>
          <p className="text-center text-[11px] leading-snug text-at-muted">
            No tablet, escolha a impressora térmica ou &quot;Salvar em PDF&quot; no diálogo do sistema.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
