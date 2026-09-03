"use client";

import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/components/layout/AppTheme";
import {
  analisePageBackground,
  appThemeToAnaliseVisual,
  type AnaliseVisualTema,
} from "@/lib/analise/analise-visual-theme";
import type { ReactNode } from "react";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-premium-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-premium-sans",
});

type MaxWidth = "2xl" | "4xl" | "6xl" | "full";

const MAX_W: Record<MaxWidth, string> = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  full: "max-w-none",
};

type Props = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: MaxWidth;
  /** Mantém variáveis de fonte locais (ex.: --font-pontos-display) */
  extraFontVars?: string;
  fontFamily?: string;
};

export function usePremiumDeskTheme(): AnaliseVisualTema {
  const { theme } = useAppTheme();
  return appThemeToAnaliseVisual(theme);
}

export function PremiumDeskShell({
  children,
  className,
  contentClassName,
  maxWidth = "6xl",
  extraFontVars,
  fontFamily = "var(--font-premium-sans), system-ui, sans-serif",
}: Props) {
  const visualTema = usePremiumDeskTheme();

  return (
    <div
      data-analise-visual={visualTema}
      className={cn(
        display.variable,
        sans.variable,
        extraFontVars,
        "premium-desk-root relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] px-4 pb-16 sm:-mx-6 sm:px-6",
        className
      )}
      style={{ fontFamily }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: analisePageBackground(visualTema) }}
        />
      </div>
      <div className={cn("relative mx-auto pt-6 sm:pt-10", MAX_W[maxWidth], contentClassName)}>
        {children}
      </div>
    </div>
  );
}
