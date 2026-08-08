"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
};

export function FotoKit({ preview, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">Foto do kit (opcional)</label>
      <p className="text-xs text-slate-500">
        Tire uma foto de como o kit montado fica — ajuda a identificar na hora de alocar no ponto.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative w-fit">
          <ExpandableImage src={preview} alt="Foto do kit" className="h-32 w-32 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm",
            "border-slate-600 text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon"
          )}
        >
          <Camera className="h-5 w-5" />
          Tirar / adicionar foto
        </button>
      )}
    </div>
  );
}
