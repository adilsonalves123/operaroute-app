"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TermoHint({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex align-middle", className)}>
      <HelpCircle className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-[#c4a574]/80" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-md border border-white/10 bg-[#0f1419] px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-300 shadow-xl group-hover:block"
      >
        {texto}
      </span>
    </span>
  );
}
