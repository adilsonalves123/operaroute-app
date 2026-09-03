"use client";

import { OperaRouteLoader } from "./OperaRouteLoader";

type LoadingOverlayProps = {
  show: boolean;
  message?: string;
  messages?: string[];
};

/** Tela cheia estilo app de banco — use em ações importantes (coleta, baixa, etc.) */
export function LoadingOverlay({ show, message, messages }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-lg"
      style={{ background: "color-mix(in srgb, var(--background) 94%, transparent)" }}
      aria-modal="true"
      aria-label="Processando"
      role="alertdialog"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="or-loader-glow or-loader-glow-1" />
        <div className="or-loader-glow or-loader-glow-2" />
      </div>
      <OperaRouteLoader message={message} messages={messages} variant="fullscreen" />
    </div>
  );
}
