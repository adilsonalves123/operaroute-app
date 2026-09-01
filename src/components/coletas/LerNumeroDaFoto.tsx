"use client";

import { useId, useRef, useState } from "react";
import { Camera, Check, Copy, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { capturarFotoNativa } from "@/lib/camera/captura-nativa";
import { isNativeAndroidApp } from "@/lib/push/client";
import { cn } from "@/lib/utils";
import type { ModoLeituraNumeroFoto } from "@/lib/ia/ler-numero-foto";

type Props = {
  modo?: ModoLeituraNumeroFoto;
  onUsar: (valorFormatado: string) => void;
  className?: string;
  disabled?: boolean;
};

async function comprimirFoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg") || "leitura.jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function LerNumeroDaFoto({
  modo = "contador",
  onUsar,
  className,
  disabled = false,
}: Props) {
  const cameraId = useId();
  const galeriaId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const [menuAberto, setMenuAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    numero: string;
    confianca: number;
    rotulo: string | null;
    preview: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function processarFoto(file: File) {
    setLendo(true);
    setErro(null);
    setCopiado(false);
    setResultado(null);

    const preview = URL.createObjectURL(file);

    try {
      const foto = await comprimirFoto(file);
      const form = new FormData();
      form.append("foto", foto);
      form.append("modo", modo);

      const res = await fetch("/api/equipamentos/ler-numero-foto", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        error?: string;
        numero?: string;
        confianca?: number;
        rotulo?: string | null;
      };

      if (!res.ok) {
        URL.revokeObjectURL(preview);
        setErro(json.error || "Não foi possível ler a foto.");
        return;
      }

      if (!json.numero?.trim()) {
        URL.revokeObjectURL(preview);
        setErro("Nenhum número encontrado na foto.");
        return;
      }

      setResultado({
        numero: json.numero.trim(),
        confianca: Number(json.confianca ?? 0),
        rotulo: json.rotulo ?? null,
        preview,
      });
    } catch {
      URL.revokeObjectURL(preview);
      setErro("Erro ao enviar a foto. Verifique a conexão.");
    } finally {
      setLendo(false);
      setMenuAberto(false);
    }
  }

  async function abrir(modoCaptura: "camera" | "galeria") {
    if (disabled || lendo) return;
    setErro(null);

    try {
      if (isNativeAndroidApp()) {
        const file = await capturarFotoNativa(modoCaptura);
        if (file) await processarFoto(file);
        return;
      }

      const input = modoCaptura === "camera" ? cameraRef.current : galeriaRef.current;
      if (!input) return;
      input.value = "";
      input.click();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível abrir a câmera.");
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processarFoto(file);
  }

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.numero);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  function usarNoCampo() {
    if (!resultado) return;
    onUsar(resultado.numero);
    limpar();
  }

  function limpar() {
    if (resultado?.preview) URL.revokeObjectURL(resultado.preview);
    setResultado(null);
    setErro(null);
    setCopiado(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        id={cameraId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        id={galeriaId}
        ref={galeriaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {!resultado ? (
        <>
          <button
            type="button"
            disabled={disabled || lendo}
            onClick={() => setMenuAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {lendo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {lendo ? "Lendo foto…" : "Ler da foto"}
          </button>

          {menuAberto ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl">
              <button
                type="button"
                disabled={lendo}
                onClick={() => void abrir("camera")}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-100 hover:bg-white/[0.04] disabled:opacity-50"
              >
                <Camera className="h-4 w-4 text-cyan-400" />
                <span>
                  <span className="block text-xs font-medium">Câmera</span>
                  <span className="block text-[10px] text-slate-500">Foto do visor agora</span>
                </span>
              </button>
              <button
                type="button"
                disabled={lendo}
                onClick={() => void abrir("galeria")}
                className="flex w-full items-center gap-3 border-t border-white/[0.06] px-3 py-2.5 text-left text-sm text-slate-100 hover:bg-violet-500/10 disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4 text-violet-300" />
                <span>
                  <span className="block text-xs font-medium">Galeria</span>
                  <span className="block text-[10px] text-slate-500">Escolher foto salva</span>
                </span>
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultado.preview}
              alt="Foto lida"
              className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Número detectado</p>
              <p className="text-lg font-semibold tabular-nums text-white break-all">
                {resultado.numero}
              </p>
              {resultado.rotulo ? (
                <p className="text-[11px] text-slate-500 truncate">{resultado.rotulo}</p>
              ) : null}
              {resultado.confianca < 0.65 ? (
                <p className="text-[11px] text-amber-400/90 mt-0.5">
                  Confira antes de usar — leitura com baixa confiança.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={limpar}
              className="shrink-0 rounded-full p-1 text-slate-500 hover:text-slate-300"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={usarNoCampo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-neon px-2.5 py-1.5 text-xs font-semibold text-slate-900"
            >
              Usar no campo
            </button>
          </div>
        </div>
      )}

      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
    </div>
  );
}
