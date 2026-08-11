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
 * Um botão "Foto" → escolhe Câmera ou Galeria.
 * `input.click()` no mesmo gesto do usuário (obrigatório no mobile).
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
  const [menuAberto, setMenuAberto] = useState(false);

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

    setMenuAberto(false);
    lockUntilRef.current = Date.now() + LOCK_MS;
    setAbrindo(modo);
    input.value = "";

    try {
      input.click();
    } catch {
      lockUntilRef.current = 0;
      setAbrindo(null);
      return;
    }

    window.setTimeout(() => {
      setAbrindo((atual) => (atual === modo ? null : atual));
      if (Date.now() >= lockUntilRef.current) lockUntilRef.current = 0;
    }, 12_000);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    lockUntilRef.current = 0;
    setAbrindo(null);
    setMenuAberto(false);
    onChange(file);
    e.target.value = "";
  }

  function limpar() {
    onChange(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
    lockUntilRef.current = 0;
    setAbrindo(null);
    setMenuAberto(false);
  }

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
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => setMenuAberto((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2.5 text-sm text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            Trocar foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={abrindo != null}
          onClick={() => setMenuAberto((v) => !v)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm transition disabled:cursor-wait disabled:opacity-60",
            erro
              ? "border-red-500/50 text-red-400"
              : "border-slate-600 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300",
            buttonClassName
          )}
        >
          <Camera className="h-5 w-5" />
          {abrindo ? "Abrindo…" : "Foto"}
        </button>
      )}

      {menuAberto ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl">
          <p className="border-b border-white/[0.06] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Como quer adicionar a foto?
          </p>
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => abrir("camera")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-slate-100 transition hover:bg-white/[0.04] disabled:opacity-50"
          >
            <Camera className="h-4 w-4 text-cyan-400" />
            <span>
              <span className="block font-medium">Câmera</span>
              <span className="block text-[11px] text-slate-500">Tirar foto agora</span>
            </span>
          </button>
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => abrir("galeria")}
            className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 text-left text-sm text-slate-100 transition hover:bg-violet-500/10 disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4 text-violet-300" />
            <span>
              <span className="block font-medium">Galeria</span>
              <span className="block text-[11px] text-slate-500">Escolher foto salva</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMenuAberto(false)}
            className="w-full border-t border-white/[0.06] px-4 py-2.5 text-center text-xs text-slate-500 hover:text-slate-300"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
    </div>
  );
}
