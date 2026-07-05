"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export function ExcluirColetaFuraFuraButton({ coletaId }: { coletaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const ok = confirm(
      "Excluir esta coleta? Isso remove lançamentos financeiros, pendências e restaura furos/brindes no ponto."
    );
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/coletas/fura-fura/${coletaId}`, {
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
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
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
