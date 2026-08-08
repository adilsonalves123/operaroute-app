"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
};

export function FotoEquipamento({ preview, onChange, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("space-y-1.5", compact && "w-fit")}>
      <label className="block text-sm font-medium text-slate-300">
        Foto {compact ? "" : "da máquina "}(opcional)
      </label>
      {!compact && (
        <p className="text-xs text-slate-500">
          Ajuda a identificar cada máquina na hora da coleta.
        </p>
      )}
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
          <ExpandableImage
            src={preview}
            alt="Foto da máquina"
            className={cn(
              "rounded-lg object-cover ring-1 ring-white/10",
              compact ? "h-16 w-16" : "h-24 w-24"
            )}
          />
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
            "flex items-center justify-center rounded-lg border border-dashed text-sm",
            compact
              ? "h-16 w-16 flex-col gap-0.5 p-1"
              : "h-24 w-24 flex-col gap-1",
            "border-slate-600 text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon"
          )}
        >
          <Camera className={compact ? "h-4 w-4" : "h-5 w-5"} />
          <span className={cn(compact ? "text-[9px]" : "text-[10px]")}>Foto</span>
        </button>
      )}
    </div>
  );
}
