"use client";

import { Camera } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import type { Equipamento } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/**
 * Miniatura na lista: só amplia a foto.
 * Trocar/adicionar foto fica no modal Editar máquina.
 */
export function EquipamentoFotoThumb({
  equipamento,
}: {
  equipamento: Equipamento;
  /** @deprecated Upload removido da lista — use Editar máquina. */
  onUpdated?: (fotoUrl: string | null) => void;
}) {
  const fotoUrl = equipamento.foto_url;

  return (
    <div
      className="shrink-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {fotoUrl ? (
        <ExpandableImage
          src={fotoUrl}
          alt={equipamento.nome || "Foto da máquina"}
          fullWidth={false}
          className="h-11 w-11 rounded-sm object-cover ring-1 ring-white/[0.08]"
        />
      ) : (
        <div
          className={cn(
            "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-white/[0.12] text-slate-600"
          )}
          title="Sem foto — adicione em Editar máquina"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="text-[8px] tracking-wide">Foto</span>
        </div>
      )}
    </div>
  );
}
