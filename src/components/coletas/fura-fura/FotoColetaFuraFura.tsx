"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  erro?: string | null;
};

export function FotoColetaFuraFura({ preview, onChange, erro }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    onChange(file);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">Foto da máquina *</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative">
          <ExpandableImage src={preview} alt="Foto da coleta" className="h-36" />
          <button
            type="button"
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm hover:border-primary-neon/40 hover:text-primary-neon",
            erro ? "border-red-500/50 text-red-400" : "border-slate-600 text-slate-400"
          )}
        >
          <Camera className="h-5 w-5" />
          Tirar foto ou escolher da galeria
        </button>
      )}
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
