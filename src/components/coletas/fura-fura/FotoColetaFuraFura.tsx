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

  const urlAnterior = String(ultimaColeta?.foto_url ?? "").trim();

  if (!urlAnterior) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-amber-400/90">
          Sem foto da última coleta neste ponto — tire a foto da máquina agora para
          referência nas próximas visitas.
        </p>
        {novaFoto}
      </div>
    );
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
            src={urlAnterior}
            alt="Foto da última coleta"
            className="h-36"
          />
          {ultimaColeta?.created_at ? (
            <p className="text-xs text-slate-500">
              {formatDateTime(ultimaColeta.created_at)}
            </p>
          ) : null}
        </div>
        {novaFoto}
      </div>
    </div>
  );
}
