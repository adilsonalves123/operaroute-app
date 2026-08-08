"use client";

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { COOKIE_SIMULAR_TRIAL } from "@/lib/assinatura-simulacao";

/** Barra fixa enquanto a simulação de trial encerrado estiver ativa. */
export function SimulacaoTrialBar() {
  const [loading, setLoading] = useState(false);

  async function encerrar() {
    setLoading(true);
    try {
      document.cookie = `${COOKIE_SIMULAR_TRIAL}=; path=/; max-age=0; SameSite=Lax`;
      await fetch("/api/empresa/simular-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "off" }),
      });
      window.location.assign("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-[12px] text-amber-100">
      <div className="flex min-w-0 items-center gap-2">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">
          <strong>Simulação:</strong> você está vendo o app como se o teste de 7
          dias tivesse acabado.
        </span>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => void encerrar()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/40 px-2.5 py-1 font-medium hover:bg-amber-500/20 disabled:opacity-60"
      >
        <X className="h-3.5 w-3.5" />
        Sair da simulação
      </button>
    </div>
  );
}
