"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  size?: "sm" | "md" | "lg";
};

export function FotoPontoField({
  preview,
  onChange,
  label = "Foto do estabelecimento",
  hint = "Fachada ou interior — aparece na lista, rotas e mapa",
  size = "md",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const previewClass =
    size === "lg" ? "h-32 w-32" : size === "sm" ? "h-20 w-20" : "h-24 w-24";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative w-fit max-w-full">
          <ExpandableImage
            src={preview}
            alt="Foto do ponto"
            fullWidth={false}
            className={cn("rounded-xl object-cover border border-white/10", previewClass)}
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 z-10 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm",
            "border-slate-600 text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon"
          )}
        >
          <Camera className="h-5 w-5" />
          Tirar ou escolher foto
        </button>
      )}
    </div>
  );
}
