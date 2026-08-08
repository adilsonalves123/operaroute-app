"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  pontoId: string;
  className?: string;
  label?: string;
  continuarLabel?: string;
  rascunhoId?: string | null;
};

export function IniciarVisitaButton({
  pontoId,
  className,
  label = "Iniciar visita",
  continuarLabel = "Continuar visita",
  rascunhoId,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (rascunhoId) {
      router.push(`/visitas-ponto/${rascunhoId}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/visitas-ponto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ponto_id: pontoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao iniciar visita.");
        return;
      }
      router.push(`/visitas-ponto/${data.id}`);
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
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "glass-card flex w-full items-center gap-3 border border-primary-neon/25 p-4 text-left transition hover:border-primary-neon/50 hover:bg-primary-neon/5",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-neon" />
      ) : (
        <MapPin className="h-5 w-5 shrink-0 text-primary-neon" />
      )}
      <span className="text-sm font-medium text-white">
        {rascunhoId ? continuarLabel : label}
      </span>
    </button>
  );
}
