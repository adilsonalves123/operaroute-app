"use client";

import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = [
  "Carregando sua operação...",
  "Organizando os dados...",
  "Preparando tudo para você...",
  "Quase lá...",
];

type OperaRouteLoaderProps = {
  message?: string;
  messages?: string[];
  /** Versão menor para dentro do app (ex.: loading.tsx) */
  variant?: "fullscreen" | "inline";
};

export function OperaRouteLoader({
  message,
  messages = DEFAULT_MESSAGES,
  variant = "inline",
}: OperaRouteLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const displayMessage = message ?? messages[msgIndex];

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2400);
    return () => clearInterval(id);
  }, [message, messages]);

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        variant === "fullscreen" ? "min-h-[70vh] px-6" : "py-16 px-6"
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative h-32 w-32 mb-8">
        <div className="or-loader-ring or-loader-ring-1" aria-hidden />
        <div className="or-loader-ring or-loader-ring-2" aria-hidden />
        <div className="or-loader-ring or-loader-ring-3" aria-hidden />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-3 text-primary-neon"
          aria-hidden
        >
          <path
            d="M18 72 C 35 28, 55 88, 82 38"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="or-route-draw"
          />
          <circle cx="18" cy="72" r="4" fill="currentColor" className="or-loader-node" />
          <circle
            cx="82"
            cy="38"
            r="4"
            fill="var(--success)"
            className="or-loader-node or-loader-node-delay"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[11px] font-bold tracking-tight text-white/90">
            Opera<span className="text-primary-neon">Route</span>
          </p>
        </div>
      </div>

      <p key={displayMessage} className="or-loader-message text-sm text-slate-400 text-center max-w-xs">
        {displayMessage}
      </p>

      <div className="flex gap-2 mt-5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="or-loader-dot h-1.5 w-1.5 rounded-full bg-primary-neon/80"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
