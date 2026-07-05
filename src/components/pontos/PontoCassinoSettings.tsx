"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface PontoCassinoSettingsProps {
  pontoId: string;
  abaterAutomatico: boolean;
  comissaoPercentual: number;
}

export function PontoCassinoSettings({
  pontoId,
  abaterAutomatico,
  comissaoPercentual,
}: PontoCassinoSettingsProps) {
  const router = useRouter();
  const [abater, setAbater] = useState(abaterAutomatico);
  const [comissao, setComissao] = useState(String(comissaoPercentual));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          abater_automatico: abater,
          comissao_percentual: parseFloat(comissao) || 0,
        }),
      });
      if (res.ok) {
        setMsg("Salvo!");
        router.refresh();
      } else {
        const data = await res.json();
        setMsg(data.error ?? "Erro ao salvar");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="glass-card p-6 space-y-4">
      <h2 className="font-semibold text-white">Configurações cassino</h2>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={abater}
          onChange={(e) => setAbater(e.target.checked)}
          className="rounded border-slate-600"
        />
        <span className="text-sm text-slate-300">
          Abater débito negativo automaticamente na próxima coleta
        </span>
      </label>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-300">Comissão do ponto (%)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={comissao}
          onChange={(e) => setComissao(e.target.value)}
          className="w-full max-w-xs"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Salvar configurações"}
      </button>
      {msg && <p className="text-xs text-slate-400">{msg}</p>}
    </div>

    <LoadingOverlay show={loading} message="Salvando configurações..." />
    </>
  );
}
