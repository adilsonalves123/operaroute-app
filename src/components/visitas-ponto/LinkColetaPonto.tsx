"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildColetaUrl } from "@/lib/visitas-ponto";
import type { VisitaPontoNicho } from "@/lib/visitas-ponto/types";

type Props = {
  pontoId: string;
  nicho: VisitaPontoNicho;
  viaVisita: boolean;
  rascunhoId?: string | null;
  className?: string;
  children: React.ReactNode;
};

/** Atalho do ponto: em multi-nicho abre a coleta já dentro da visita. */
export function LinkColetaPonto({
  pontoId,
  nicho,
  viaVisita,
  rascunhoId,
  className,
  children,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const hrefAvulso =
    nicho === "cassino"
      ? `/coletas/nova/cassino?ponto=${pontoId}`
      : nicho === "fura_fura"
        ? `/coletas/nova/fura-fura?ponto=${pontoId}`
        : nicho === "diversao"
          ? `/coletas/nova/diversao?ponto=${pontoId}`
          : nicho === "bolinha"
            ? `/coletas/nova/bolinha?ponto=${pontoId}`
            : nicho === "consignado"
              ? `/coletas/nova/consignado?ponto=${pontoId}`
              : `/coletas/nova/ursinho?ponto=${pontoId}`;

  if (!viaVisita) {
    return (
      <Link href={hrefAvulso} className={className}>
        {children}
      </Link>
    );
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (rascunhoId) {
      router.push(buildColetaUrl(nicho, pontoId, rascunhoId));
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
      if (!res.ok || !data.id) {
        router.push(hrefAvulso);
        return;
      }
      router.push(buildColetaUrl(nicho, pontoId, data.id));
    } catch {
      router.push(hrefAvulso);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={cn(className, "text-left")}>
      {loading ? (
        <span className="inline-flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin opacity-70" />
          Abrindo visita…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
