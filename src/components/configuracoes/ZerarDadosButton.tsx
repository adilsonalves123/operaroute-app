"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export function ZerarDadosButton() {
  const router = useRouter();
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleZerar() {
    setError("");

    const linhas = [
      "Isso apaga permanentemente:",
      "• Todo o caixa (financeiro)",
      "• Todas as coletas e visitas",
      "• Todas as pendências",
      "",
      "Permanecem: pontos, máquinas e configurações da operação.",
      "",
      "Esta ação não pode ser desfeita.",
    ];

    if (!confirm(linhas.join("\n"))) return;

    if (confirmacao.trim().toUpperCase() !== "ZERAR") {
      setError('Digite ZERAR no campo abaixo para confirmar.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/empresa/zerar-dados", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao: confirmacao.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao zerar dados.");
        return;
      }

      setConfirmacao("");
      alert("Dados operacionais zerados com sucesso.");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-red-300">Zona de perigo</p>
            <p className="text-slate-400 leading-relaxed">
              Remove caixa, coletas, visitas e pendências. Pontos e máquinas cadastrados
              permanecem.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmacao-zerar" className="block text-xs text-slate-500">
            Digite <strong className="text-slate-400">ZERAR</strong> para confirmar
          </label>
          <input
            id="confirmacao-zerar"
            type="text"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder="ZERAR"
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border border-red-500/30 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="button"
          disabled={loading || confirmacao.trim().toUpperCase() !== "ZERAR"}
          onClick={handleZerar}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Zerar dados operacionais
        </button>
      </div>

      <LoadingOverlay
        show={loading}
        messages={["Removendo coletas...", "Limpando caixa...", "Quase lá..."]}
      />
    </>
  );
}
