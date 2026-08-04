"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

const LOCK_MS = 2800;

type Props = {
  preview: string | null;
  onChange: (file: File | null) => void;
  erro?: string | null;
  label?: string;
  hint?: string;
  alt?: string;
  buttonClassName?: string;
  className?: string;
};

/**
 * Captura de foto na coleta com trava anti-disparo duplo.
 *
 * Em tablets (Android/WebView), `capture="environment"` + toque costuma reabrir
 * a câmera várias vezes. Aqui não forçamos capture (o sistema oferece câmera
 * ou galeria uma vez) e bloqueamos novos cliques enquanto o seletor está aberto.
 */
export function FotoColetaCaptura({
  preview,
  onChange,
  erro,
  label = "Foto da coleta *",
  hint,
  alt = "Foto da coleta",
  buttonClassName,
  className,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const lockUntilRef = useRef(0);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    function liberar() {
      if (document.visibilityState === "hidden") return;
      window.setTimeout(() => {
        lockUntilRef.current = 0;
        setAbrindo(false);
      }, 700);
    }
    document.addEventListener("visibilitychange", liberar);
    window.addEventListener("focus", liberar);
    return () => {
      document.removeEventListener("visibilitychange", liberar);
      window.removeEventListener("focus", liberar);
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    };
  }, []);

  function estaTravado() {
    return abrindo || Date.now() < lockUntilRef.current;
  }

  function abrirSeletor(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (estaTravado()) return;

    lockUntilRef.current = Date.now() + LOCK_MS;
    setAbrindo(true);

    const input = inputRef.current;
    if (!input) return;
    input.value = "";

    // Atrasa o click nativo para o toque fantasma (touch→click) não abrir 2x.
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    openingTimerRef.current = setTimeout(() => {
      try {
        input.click();
      } catch {
        lockUntilRef.current = 0;
        setAbrindo(false);
      }
    }, 50);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    lockUntilRef.current = 0;
    setAbrindo(false);
    onChange(file);
    e.target.value = "";
  }

  function limpar() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
    lockUntilRef.current = 0;
    setAbrindo(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <span className="block text-sm font-medium text-slate-300">{label}</span>
      ) : null}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {preview ? (
        <div className="relative">
          <ExpandableImage src={preview} alt={alt} className="h-36" />
          <button
            type="button"
            onClick={limpar}
            className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Remover foto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={abrindo}
          onClick={abrirSeletor}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm transition disabled:cursor-wait disabled:opacity-60",
            erro
              ? "border-red-500/50 text-red-400"
              : "border-slate-600 text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon",
            buttonClassName
          )}
        >
          <Camera className="h-5 w-5" />
          {abrindo ? "Abrindo…" : "Tirar foto ou escolher da galeria"}
        </button>
      )}

      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
    </div>
  );
}
