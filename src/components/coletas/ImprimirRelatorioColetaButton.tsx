"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { coletaBtnSecondaryClass } from "@/components/coletas/layout/coleta-form-styles";
import type { FormatoImpressao } from "@/lib/coletas/imprimir-relatorio-texto";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  className?: string;
  onImprimir: (formato: FormatoImpressao) => boolean;
};

const OPCOES: { id: FormatoImpressao; label: string; hint: string }[] = [
  { id: "termica", label: "Térmica", hint: "58 / 80 mm" },
  { id: "a4", label: "Papel A4", hint: "Folha comum" },
];

export function ImprimirRelatorioColetaButton({ disabled, className, onImprimir }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function fechar(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", fechar);
    document.addEventListener("touchstart", fechar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("touchstart", fechar);
    };
  }, [open]);

  function imprimir(formato: FormatoImpressao) {
    setOpen(false);
    const ok = onImprimir(formato);
    if (!ok) {
      window.alert(
        "Não foi possível abrir a impressão. Toque em Imprimir novamente ou use Compartilhar e imprima pelo navegador."
      );
    }
  }

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <div className="inline-flex overflow-hidden rounded-lg border border-at">
        <button
          type="button"
          disabled={disabled}
          onClick={() => imprimir("termica")}
          className={coletaBtnSecondaryClass("rounded-none border-0")}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={coletaBtnSecondaryClass("rounded-none border-0 border-l border-at px-2.5")}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Escolher formato de impressão"
        >
          <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[210px] overflow-hidden rounded-lg border border-at bg-at-card py-1 shadow-lg"
        >
          {OPCOES.map((op) => (
            <button
              key={op.id}
              type="button"
              role="menuitem"
              onClick={() => imprimir(op.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-at-card-soft"
            >
              <span className="font-medium text-at-primary">{op.label}</span>
              <span className="text-xs text-at-muted">{op.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
