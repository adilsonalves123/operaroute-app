"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import type { Equipamento } from "@/lib/types/database";

export function EquipamentoExcluirButton({ equipamento }: { equipamento: Equipamento }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const nome = getEquipamentoDisplayNome(equipamento);
    const ok = confirm(
      `Excluir ${nome} deste ponto?\n\nA máquina some das próximas coletas. Coletas e visitas antigas continuam no histórico. Pendências do ponto não são alteradas.`
    );
    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao excluir equipamento.");
        return;
      }

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
        className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-50"
        title="Excluir equipamento"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <LoadingOverlay
        show={loading}
        messages={["Removendo equipamento...", "Atualizando ponto...", "Quase lá..."]}
      />
    </>
  );
}
