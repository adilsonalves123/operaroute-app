"use client";

import { Printer } from "lucide-react";
import { abrirImpressaoRelatorioTexto, type RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";

/** Imprime comprovante só texto/números (sem foto). */
export function ImprimirColetaCassinoButton({
  data,
  className,
}: {
  data: RelatorioColetaData;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const ok = abrirImpressaoRelatorioTexto({ ...data, previa: false });
        if (!ok) {
          window.alert("Permita pop-ups neste site para imprimir.");
        }
      }}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800"
      }
    >
      <Printer className="h-4 w-4" />
      Imprimir
    </button>
  );
}
