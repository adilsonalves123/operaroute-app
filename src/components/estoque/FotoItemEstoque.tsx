"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
};

export function FotoItemEstoque({ preview, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">Foto do item (opcional)</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onChange(file);
          // Permite escolher o mesmo arquivo de novo depois de remover
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Foto do item"
              className="h-24 w-24 rounded-lg border border-slate-700 object-cover"
            />
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="absolute -top-2 -right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Remover foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="text-sm text-primary-neon hover:underline"
          >
            Trocar foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className={cn(
            "flex w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm",
            "border-slate-600 text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon"
          )}
        >
          <Camera className="h-5 w-5" />
          Adicionar foto
        </button>
      )}
    </div>
  );
}
