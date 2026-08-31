"use client";

import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
};

export function FotoEquipamento({ preview, onChange, compact = false }: Props) {
  return (
    <FotoColetaCaptura
      preview={preview}
      onChange={onChange}
      label={compact ? undefined : "Foto da máquina (opcional)"}
      hint={
        compact
          ? undefined
          : "Ajuda a identificar cada máquina na hora da coleta. Toque na foto para ampliar."
      }
      alt="Foto da máquina"
      className={cn(compact && "w-fit")}
      buttonClassName={cn(compact ? "h-16 w-16 max-w-none py-2" : "max-w-xs")}
    />
  );
}
