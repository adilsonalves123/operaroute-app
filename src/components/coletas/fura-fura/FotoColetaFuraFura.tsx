"use client";

import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { formatDateTime } from "@/lib/utils";

export type UltimaColetaFoto = {
  foto_url: string;
  created_at: string;
};

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  erro?: string | null;
  ultimaColeta?: UltimaColetaFoto | null;
};

export function FotoColetaFuraFura({ preview, onChange, erro, ultimaColeta }: Props) {
  const novaFoto = (
    <FotoColetaCaptura
      preview={preview}
      onChange={onChange}
      erro={erro}
      label="Foto da máquina *"
    />
  );

  if (!ultimaColeta?.foto_url) {
    return novaFoto;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Compare com a foto da visita anterior para conferir o que saiu da máquina.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-400">Última coleta</label>
          <ExpandableImage
            src={ultimaColeta.foto_url}
            alt="Foto da última coleta"
            className="h-36"
          />
          <p className="text-xs text-slate-500">{formatDateTime(ultimaColeta.created_at)}</p>
        </div>
        {novaFoto}
      </div>
    </div>
  );
}
