"use client";

import { Instrument_Serif, Outfit } from "next/font/google";
import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/layout/AppTheme";
import {
  analisePageBackground,
  appThemeToAnaliseVisual,
} from "@/lib/analise/analise-visual-theme";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-loader-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-loader-sans",
});

const DEFAULT_MESSAGES = [
  "Preparando sua operação...",
  "Carregando dados com segurança...",
  "Organizando o painel...",
  "Quase pronto...",
];

type OperaRouteLoaderProps = {
  message?: string;
  messages?: string[];
  variant?: "fullscreen" | "inline";
};

export function OperaRouteLoader({
  message,
  messages = DEFAULT_MESSAGES,
  variant = "inline",
}: OperaRouteLoaderProps) {
  const { theme: appTheme } = useAppTheme();
  const visualTema = appThemeToAnaliseVisual(appTheme);
  const [msgIndex, setMsgIndex] = useState(0);
  const displayMessage = message ?? messages[msgIndex];

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2600);
    return () => clearInterval(id);
  }, [message, messages]);

  return (
    <div
      data-analise-visual={visualTema}
      className={cn(
        display.variable,
        sans.variable,
        "premium-desk-root relative flex w-full flex-col items-center justify-center overflow-hidden",
        variant === "fullscreen"
          ? "min-h-[min(100%,86vh)] px-6 py-14 sm:px-12"
          : "min-h-[min(100%,82vh)] px-6 py-16"
      )}
      style={{ fontFamily: "var(--font-loader-sans), system-ui, sans-serif" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: analisePageBackground(visualTema) }}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.36em] text-at-accent sm:text-xs">
          OperaRoute
        </p>

        <div className="relative mt-10 mb-12 h-52 w-52 sm:mt-12 sm:mb-14 sm:h-64 sm:w-64" aria-hidden>
          <div className="or-premium-ring or-premium-ring-outer absolute inset-0" />
          <div className="or-premium-ring or-premium-ring-mid absolute inset-[18px] sm:inset-[22px]" />
          <div className="or-premium-arc absolute inset-[8px] sm:inset-[10px]" />

          <svg
            viewBox="0 0 100 100"
            className="absolute inset-[36px] text-at-link sm:inset-[44px]"
          >
            <path
              d="M22 68 C 38 34, 52 78, 78 42"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="or-premium-route"
            />
            <circle cx="22" cy="68" r="3.4" fill="var(--at-accent)" className="or-premium-node" />
            <circle
              cx="78"
              cy="42"
              r="3.4"
              fill="var(--at-link)"
              className="or-premium-node or-premium-node-delay"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[42px] leading-none tracking-tight text-at-primary sm:text-[52px]"
              style={{ fontFamily: "var(--font-loader-display), Georgia, serif" }}
            >
              OR
            </span>
          </div>
        </div>

        <h1
          className="text-[clamp(2.75rem,7vw,4rem)] leading-none tracking-tight text-at-primary"
          style={{ fontFamily: "var(--font-loader-display), Georgia, serif" }}
        >
          OperaRoute
        </h1>

        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-at-muted sm:mt-5 sm:max-w-lg sm:text-[17px]">
          Gestão profissional da sua operação em campo.
        </p>

        <div className="or-premium-progress mt-10 h-[3px] w-full max-w-[320px] overflow-hidden rounded-full bg-at-track sm:mt-12 sm:max-w-[380px]">
          <span className="or-premium-progress-bar block h-full w-1/2 rounded-full bg-gradient-to-r from-[var(--at-accent)]/40 via-[var(--at-accent)] to-[var(--at-accent)]/40" />
        </div>

        <p
          key={displayMessage}
          className="or-loader-message mt-7 text-[14px] text-at-muted sm:mt-8 sm:text-[15px]"
        >
          {displayMessage}
        </p>
      </div>
    </div>
  );
}
