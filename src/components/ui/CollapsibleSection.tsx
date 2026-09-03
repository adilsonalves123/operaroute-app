"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  id,
  label,
  title,
  subtitle,
  aberto,
  onToggle,
  children,
  className,
}: {
  id?: string;
  label: string;
  title: string;
  subtitle?: string;
  aberto: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mt-10", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-left transition hover:border-[#c4a574]/20 sm:px-5"
        aria-expanded={aberto}
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a574]/85">{label}</p>
          <h2
            className="mt-1.5 text-xl tracking-tight text-[#f4efe6] sm:text-2xl"
            style={{ fontFamily: "var(--font-dash-display, var(--font-analise-display)), Georgia, serif" }}
          >
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-slate-500 transition",
            aberto && "rotate-180 text-[#c4a574]"
          )}
        />
      </button>
      {aberto ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
