"use client";

import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
};

export function FotoKit({ preview, onChange }: Props) {
  return (
    <FotoColetaCaptura
      preview={preview}
      onChange={onChange}
      label="Foto do kit (opcional)"
      hint="Tire uma foto de como o kit montado fica — ajuda a identificar na hora de alocar no ponto."
      alt="Foto do kit"
      buttonClassName="max-w-xs"
    />
  );
}
