"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800"
    >
      <Printer className="h-4 w-4" />
      Imprimir
    </button>
  );
}
