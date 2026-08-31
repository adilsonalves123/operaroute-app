"use client";

import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
};

export function FotoItemEstoque({ preview, onChange }: Props) {
  return (
    <FotoColetaCaptura
      preview={preview}
      onChange={onChange}
      label="Foto do item (opcional)"
      alt="Foto do item"
      buttonClassName="max-w-xs"
    />
  );
}
