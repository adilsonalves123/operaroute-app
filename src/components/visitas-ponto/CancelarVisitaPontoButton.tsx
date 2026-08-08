"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

type Props = {
  visitaPontoId: string;
  pontoId: string;
};

export function CancelarVisitaPontoButton({ visitaPontoId, pontoId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancelar() {
    if (
      !confirm(
        "Cancelar esta visita? As coletas já salvas permanecem no ponto, mas você poderá iniciar uma nova visita."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/visitas-ponto/${visitaPontoId}/cancelar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao cancelar visita.");
        return;
      }
      router.push(`/pontos/${pontoId}`);
      router.refresh();
    } catch {
      alert("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancelar}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:border-red-500/30 hover:text-red-400 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
      Cancelar visita
    </button>
  );
}
