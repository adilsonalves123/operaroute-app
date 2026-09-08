"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import "./excluir-coleta-nicho.css";

export function ExcluirColetaNichoButton({
  apiPath,
  confirmMessage = "Excluir esta coleta? Isso apaga também as pendências dessa coleta e os lançamentos financeiros.",
}: {
  coletaId: string;
  apiPath: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const ok = confirm(confirmMessage);
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiPath, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao excluir coleta.");
        return;
      }
      router.push("/coletas");
      router.refresh();
    } catch {
      setError("Erro de conexão ao excluir coleta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-1">
        <button
          type="button"
          disabled={loading}
          onClick={handleDelete}
          className="coleta-nicho-btn-excluir inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {loading ? "Excluindo..." : "Excluir coleta"}
        </button>
        {error && <p className="max-w-sm text-xs text-red-400">{error}</p>}
      </div>
      <LoadingOverlay show={loading} message="Excluindo coleta..." />
    </>
  );
}
