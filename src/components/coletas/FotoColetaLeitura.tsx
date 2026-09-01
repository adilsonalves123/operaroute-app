"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { FotoLeituraSegurar } from "@/components/coletas/FotoLeituraSegurar";
import { capturarFotoNativa } from "@/lib/camera/captura-nativa";
import { isNativeAndroidApp } from "@/lib/push/client";
import { cn } from "@/lib/utils";

const LOCK_MS = 1800;

type Props = {
  preview: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  modo?: "contador" | "entrada_saida";
  onContador?: (valor: string) => void;
  onEntrada?: (valor: string) => void;
  onSaida?: (valor: string) => void;
  entradaPreenchida?: boolean;
  saidaPreenchida?: boolean;
  erro?: string | null;
  label?: string;
  hint?: string;
  alt?: string;
  buttonClassName?: string;
  className?: string;
};

/**
 * Foto da coleta em largura total: arraste para selecionar, Copiar, colar manualmente.
 */
export function FotoColetaLeitura({
  preview,
  file,
  onChange,
  modo = "contador",
  onContador: _onContador,
  onEntrada: _onEntrada,
  onSaida: _onSaida,
  entradaPreenchida: _entradaPreenchida,
  saidaPreenchida: _saidaPreenchida,
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
  const [erroLocal, setErroLocal] = useState<string | null>(null);

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

  async function abrir(modoCaptura: "camera" | "galeria") {
    if (estaTravado()) return;
    setMenuAberto(false);
    setErroLocal(null);
    lockUntilRef.current = Date.now() + LOCK_MS;
    setAbrindo(modoCaptura);

    try {
      if (isNativeAndroidApp()) {
        const picked = await capturarFotoNativa(modoCaptura);
        if (picked) onChange(picked);
        return;
      }
      const input = modoCaptura === "camera" ? cameraRef.current : galeriaRef.current;
      if (!input) return;
      input.value = "";
      input.click();
    } catch (err) {
      setErroLocal(err instanceof Error ? err.message : "Não foi possível abrir a câmera.");
    } finally {
      lockUntilRef.current = 0;
      setAbrindo(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    lockUntilRef.current = 0;
    setAbrindo(null);
    setMenuAberto(false);
    setErroLocal(null);
    onChange(picked);
    e.target.value = "";
  }

  function limpar() {
    onChange(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
    lockUntilRef.current = 0;
    setAbrindo(null);
    setMenuAberto(false);
    setErroLocal(null);
  }

  const erroExibido = erroLocal ?? erro;
  const hintPadrao =
    "Anexe a foto e digite manualmente, ou toque na foto para marcar e copiar um grupo de números.";

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <span className="block text-sm font-medium text-slate-300">{label}</span> : null}
      {hint ?? hintPadrao ? (
        <p className="text-xs text-slate-500">{hint ?? hintPadrao}</p>
      ) : null}

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
          {file ? (
            <FotoLeituraSegurar file={file} previewUrl={preview} modo={modo} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={alt}
              className="h-36 w-full rounded-lg border border-slate-700 object-cover"
            />
          )}
          <button
            type="button"
            onClick={limpar}
            className="absolute top-2 right-2 z-30 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
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
            erroExibido
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
          <button
            type="button"
            disabled={abrindo != null}
            onClick={() => void abrir("camera")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-slate-100 hover:bg-white/[0.04] disabled:opacity-50"
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
            onClick={() => void abrir("galeria")}
            className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 text-left text-sm text-slate-100 hover:bg-violet-500/10 disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4 text-violet-300" />
            <span>
              <span className="block font-medium">Galeria</span>
              <span className="block text-[11px] text-slate-500">Escolher foto salva</span>
            </span>
          </button>
        </div>
      ) : null}

      {erroExibido ? <p className="text-xs text-red-400">{erroExibido}</p> : null}
    </div>
  );
}
