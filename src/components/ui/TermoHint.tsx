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
      <HelpCircle className="h-3.5 w-3.5 text-at-soft transition group-hover:text-at-link/80" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-md border border-at-soft bg-[#0f1419] px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-at-primary/85 shadow-xl group-hover:block"
      >
        {texto}
      </span>
    </span>
  );
}
