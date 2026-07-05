"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

type Props = {
  pontoId: string;
  pontoNome: string;
  equipamentosCount: number;
  visitasCount: number;
  coletasCount: number;
  pendenciasCobraveisCount: number;
};

export function PontoExcluirButton({
  pontoId,
  pontoNome,
  equipamentosCount,
  visitasCount,
  coletasCount,
  pendenciasCobraveisCount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (pendenciasCobraveisCount > 0) {
      alert(
        `Não é possível excluir "${pontoNome}" enquanto houver pendências em aberto (negativo ou operação).\n\nQuite ou remova as pendências antes de apagar o ponto.`
      );
      return;
    }

    const historicoCount = visitasCount + coletasCount;
    const linhas = [
      `Excluir o ponto "${pontoNome}" permanentemente?`,
      "",
      "Serão removidos:",
      `• ${equipamentosCount} equipamento(s)`,
      `• ${historicoCount} visita(s)/coleta(s) vinculada(s)`,
      "",
      "Esta ação não pode ser desfeita.",
    ];

    if (!confirm(linhas.join("\n"))) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao excluir ponto.");
        return;
      }

      router.push("/pontos");
      router.refresh();
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={handleDelete}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Excluir ponto
      </button>

      <LoadingOverlay
        show={loading}
        messages={["Excluindo ponto...", "Removendo vínculos...", "Quase lá..."]}
      />
    </>
  );
}
