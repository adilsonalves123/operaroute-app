"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn } from "@/lib/utils";

const LOCK_MS = 1800;

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
 * Captura de foto na coleta: câmera OU galeria.
 *
 * Importante: o `input.click()` precisa rodar no mesmo gesto do usuário
 * (sem setTimeout), senão iOS/Android ignoram a abertura da galeria.
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
  const cameraId = useId();
  const galeriaId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const lockUntilRef = useRef(0);
  const [abrindo, setAbrindo] = useState<"camera" | "galeria" | null>(null);

  useEffect(() => {
    function liberar() {
      if (document.visibilityState === "hidden") return;
      window.setTimeout(() => {
        lockUntilRef.current = 0;
        setAbrindo(null);
      }, 400);
    }
    document.addEventListener("visibilitychange", liberar);
    window.addEventListener("focus", liberar);
    return () => {
      document.removeEventListener("visibilitychange", liberar);
      window.removeEventListener("focus", liberar);
    };
  }, []);

  function estaTravado() {
    return abrindo != null || Date.now() < lockUntilRef.current;
  }

  function abrir(modo: "camera" | "galeria") {
    if (estaTravado()) return;

    const input = modo === "camera" ? cameraRef.current : galeriaRef.current;
    if (!input) return;

    lockUntilRef.current = Date.now() + LOCK_MS;
    setAbrindo(modo);
    input.value = "";

    // Síncrono no gesto do usuário — obrigatório para galeria no mobile.
    try {
      input.click();
    } catch {
      lockUntilRef.current = 0;
      setAbrindo(null);
      return;
    }

    // Se o usuário cancelar o picker, libera em alguns segundos.
    window.setTimeout(() => {
      setAbrindo((atual) => (atual === modo ? null : atual));
      if (Date.now() >= lockUntilRef.current) {
        lockUntilRef.current = 0;
      }
    }, 12_000);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    lockUntilRef.current = 0;
    setAbrindo(null);
    onChange(file);
    e.target.value = "";
  }

  function limpar() {
    onChange(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
    lockUntilRef.current = 0;
    setAbrindo(null);
  }

  const btnBase =
    "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm transition disabled:cursor-wait disabled:opacity-60";

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <span className="block text-sm font-medium text-slate-300">{label}</span>
      ) : null}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}

      <input
        id={cameraId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        id={galeriaId}
        ref={galeriaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {preview ? (
        <div className="relative space-y-2">
          <ExpandableImage src={preview} alt={alt} className="h-36" />
          <button
            type="button"
            onClick={limpar}
            className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Remover foto"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={abrindo != null}
              onClick={() => abrir("camera")}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-2 py-2.5 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" />
              Nova foto
            </button>
            <button
              type="button"
              disabled={abrindo != null}
              onClick={() => abrir("galeria")}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 px-2 py-2.5 text-xs font-medium text-violet-200 hover:bg-violet-500/15 disabled:opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Galeria
            </button>
          </div>
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-2.5", buttonClassName)}>
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => abrir("camera")}
            className={cn(
              btnBase,
              erro
                ? "border-red-500/50 text-red-400"
                : "border-slate-600 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300"
            )}
          >
            <Camera className="h-5 w-5" />
            {abrindo === "camera" ? "Abrindo…" : "Câmera"}
          </button>
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => abrir("galeria")}
            className={cn(
              btnBase,
              erro
                ? "border-red-500/50 text-red-400"
                : "border-violet-500/40 bg-violet-500/[0.06] text-violet-200 hover:border-violet-400/50 hover:bg-violet-500/10"
            )}
          >
            <ImageIcon className="h-5 w-5" />
            {abrindo === "galeria" ? "Abrindo…" : "Galeria"}
          </button>
        </div>
      )}

      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
    </div>
  );
}
