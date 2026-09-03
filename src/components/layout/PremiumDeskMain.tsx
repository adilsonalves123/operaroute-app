"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { analisePageBackground } from "@/lib/analise/analise-visual-theme";
import { usePremiumDeskTheme } from "./PremiumDeskShell";

/** Fundo + tokens premium em todas as páginas do app shell. */
export function PremiumDeskMain({ children }: { children: ReactNode }) {
  const visualTema = usePremiumDeskTheme();

  return (
    <div
      data-analise-visual={visualTema}
      className={cn(
        "premium-desk-root relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] px-4 pb-16 sm:-mx-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: analisePageBackground(visualTema) }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
