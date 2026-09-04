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
import { coletaBtnSubmitClass } from "@/components/coletas/layout/coleta-form-styles";
import { cn } from "@/lib/utils";

/** Estilos só para a prévia na tela — fundo branco opaco, texto preto. */
const PREVIEW_RECEIPT_CSS = `
  .or-preview-receipt {
    background: #ffffff !important;
    color: #111111 !important;
    isolation: isolate;
  }
  .or-preview-receipt * {
    color: inherit;
  }
  .or-preview-receipt h1 {
    font-size: 14px;
    margin: 0 0 6px;
    text-align: center;
    font-weight: 700;
    color: #000 !important;
  }
  .or-preview-receipt .meta {
    text-align: center;
    margin-bottom: 10px;
    color: #333 !important;
  }
  .or-preview-receipt .meta p { margin: 0; }
  .or-preview-receipt .sep {
    border: none;
    border-top: 1px dashed #333;
    margin: 8px 0;
  }
  .or-preview-receipt .maq { margin-bottom: 8px; }
  .or-preview-receipt .maq-nome {
    font-weight: 700;
    margin-bottom: 2px;
    color: #000 !important;
  }
  .or-preview-receipt .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: #111 !important;
  }
  .or-preview-receipt .row span:last-child {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .or-preview-receipt .sec {
    font-weight: 700;
    text-transform: uppercase;
    margin: 6px 0 2px;
    font-size: 10px;
    color: #444 !important;
  }
  .or-preview-receipt .destaque { font-weight: 700; }
  .or-preview-receipt .hint {
    font-size: 10px;
    text-align: right;
    color: #555 !important;
  }
  .or-preview-receipt .foot {
    text-align: center;
    margin-top: 10px;
    font-size: 10px;
    color: #666 !important;
  }
`;

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
    <>
      <style>{PREVIEW_RECEIPT_CSS}</style>
      <div
        className="fixed inset-0 z-[300] flex items-end justify-center bg-[#1a1a1a]/80 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="imprimir-coleta-titulo"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#d6d3d1] bg-[#ffffff] shadow-2xl sm:rounded-2xl"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#e7e5e4] bg-[#ffffff] px-4 py-3">
            <div>
              <h2 id="imprimir-coleta-titulo" className="text-base font-semibold text-[#1c1917]">
                Imprimir comprovante
              </h2>
              <p className="text-xs text-[#78716c]">Escolha o papel e confirme a impressão</p>
            </div>
            <button
              type="button"
              onClick={() => {
                limparImpressaoOverlay();
                onClose();
              }}
              className="rounded-lg p-2 text-[#78716c] transition hover:bg-[#f5f5f4] hover:text-[#1c1917]"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[#e7e5e4] bg-[#fafaf9] px-4 py-3">
            {FORMATOS_IMPRESSAO.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => onFormatoChange(op.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition",
                  formato === op.id
                    ? "border-[#92662a] bg-[#faf8f4] text-[#92662a] shadow-sm"
                    : "border-[#d6d3d1] bg-[#ffffff] text-[#57534e] hover:border-[#92662a]/50"
                )}
              >
                <span className="block text-sm font-medium">{op.label}</span>
                <span className="block text-[11px] opacity-80">{op.hint}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[220px] flex-1 overflow-auto bg-[#a8a29e] p-5">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#fafaf9]">
              Prévia do comprovante
            </p>
            <div
              className={cn(
                "or-preview-receipt mx-auto overflow-hidden rounded-sm border-2 border-[#78716c] bg-[#ffffff] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
                formato === "termica_58" && "max-w-[58mm] font-mono text-[10px] leading-snug",
                formato === "termica_80" && "max-w-[80mm] font-mono text-xs leading-snug",
                formato === "a4" && "max-w-full font-serif text-sm leading-relaxed"
              )}
              style={{ backgroundColor: "#ffffff", color: "#111111" }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>

          <div className="space-y-2 border-t border-[#e7e5e4] bg-[#fafaf9] px-4 py-3">
            <button
              type="button"
              onClick={confirmarImpressao}
              className={coletaBtnSubmitClass("w-full touch-manipulation")}
            >
              <Printer className="h-4 w-4" />
              Imprimir agora
            </button>
            <p className="text-center text-[11px] leading-snug text-[#78716c]">
              No tablet, escolha a impressora térmica ou &quot;Salvar em PDF&quot; no diálogo do sistema.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
