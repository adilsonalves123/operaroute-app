"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, Maximize2, X } from "lucide-react";
import { cropFileByPixelRect, type PixelRect } from "@/lib/ia/crop-image";
import { getFotoImageLayout, type FotoImageLayout } from "@/lib/ia/foto-image-layout";
import { cn } from "@/lib/utils";

type DisplayRect = { x: number; y: number; width: number; height: number };

function normalizeRect(x1: number, y1: number, x2: number, y2: number): DisplayRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function displayRectToPixelRect(rect: DisplayRect, layout: FotoImageLayout): PixelRect | null {
  const x1 = rect.x - layout.offsetX;
  const y1 = rect.y - layout.offsetY;
  const x2 = rect.x + rect.width - layout.offsetX;
  const y2 = rect.y + rect.height - layout.offsetY;

  const clampedX1 = Math.max(0, Math.min(layout.displayW, x1));
  const clampedY1 = Math.max(0, Math.min(layout.displayH, y1));
  const clampedX2 = Math.max(0, Math.min(layout.displayW, x2));
  const clampedY2 = Math.max(0, Math.min(layout.displayH, y2));

  const width = clampedX2 - clampedX1;
  const height = clampedY2 - clampedY1;
  if (width < 8 || height < 8) return null;

  return {
    x: clampedX1 / layout.scale,
    y: clampedY1 / layout.scale,
    width: width / layout.scale,
    height: height / layout.scale,
  };
}

function MascaraEscurecida({ rect }: { rect: DisplayRect }) {
  return (
    <>
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 bg-black/60"
        style={{ height: Math.max(0, rect.y) }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 bg-black/60"
        style={{ top: rect.y + rect.height, bottom: 0 }}
      />
      <div
        className="pointer-events-none absolute bg-black/60"
        style={{ top: rect.y, left: 0, width: Math.max(0, rect.x), height: rect.height }}
      />
      <div
        className="pointer-events-none absolute bg-black/60"
        style={{ top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height }}
      />
    </>
  );
}

type SeletorProps = {
  file: File;
  previewUrl: string;
  aberto: boolean;
  onFechar: () => void;
};

function SeletorFullscreen({ file, previewUrl, aberto, onFechar }: SeletorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<FotoImageLayout | null>(null);
  const [rect, setRect] = useState<DisplayRect | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [textoLido, setTextoLido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recalcularLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const bounds = container.getBoundingClientRect();
    setLayout(
      getFotoImageLayout(img.naturalWidth, img.naturalHeight, bounds.width, bounds.height)
    );
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setRect(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
    setArrastando(false);
    startRef.current = null;
  }, [aberto, previewUrl]);

  useEffect(() => {
    if (!aberto) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    recalcularLayout();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recalcularLayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [aberto, recalcularLayout]);

  function pontoNoContainer(clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (lendo) return;
    e.preventDefault();
    const ponto = pontoNoContainer(e.clientX, e.clientY);
    if (!ponto) return;
    setErro(null);
    setTextoLido(null);
    setCopiado(false);
    startRef.current = ponto;
    setRect({ x: ponto.x, y: ponto.y, width: 0, height: 0 });
    setArrastando(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando || !startRef.current) return;
    e.preventDefault();
    const ponto = pontoNoContainer(e.clientX, e.clientY);
    if (!ponto) return;
    setRect(normalizeRect(startRef.current.x, startRef.current.y, ponto.x, ponto.y));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    e.preventDefault();
    setArrastando(false);
    startRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function limparSelecao() {
    setRect(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
  }

  async function copiarSelecao() {
    if (!layout || !rect) {
      setErro("Arraste na foto para marcar o número.");
      return;
    }
    const pixelRect = displayRectToPixelRect(rect, layout);
    if (!pixelRect) {
      setErro("Seleção muito pequena. Marque só o visor com o número.");
      return;
    }

    setLendo(true);
    setErro(null);
    setCopiado(false);
    try {
      const recorte = await cropFileByPixelRect(file, pixelRect, "selecao.jpg");
      const form = new FormData();
      form.append("foto", recorte);
      form.append("modo", "contador");
      const res = await fetch("/api/equipamentos/ler-numero-foto", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { error?: string; numero?: string };
      if (!res.ok || !json.numero?.trim()) {
        setErro(json.error || "Não leu esse trecho. Ajuste a seleção e tente de novo.");
        return;
      }
      const numero = json.numero.trim();
      setTextoLido(numero);
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Tente de novo.");
    } finally {
      setLendo(false);
    }
  }

  if (!aberto) return null;

  const temSelecao = Boolean(rect && rect.width > 12 && rect.height > 12);

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Selecione o número</p>
          <p className="text-xs text-slate-400">
            Toque e arraste em cima do número · depois toque em Copiar e cole no campo
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 p-2 sm:p-3">
        <div
          ref={containerRef}
          className="relative mx-auto h-full w-full overflow-hidden rounded-xl border border-slate-700 bg-black"
          style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={previewUrl}
            alt="Foto para seleção"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
            onLoad={recalcularLayout}
          />

          {rect && temSelecao ? (
            <>
              <MascaraEscurecida rect={rect} />
              <div
                className="pointer-events-none absolute border-[3px] border-yellow-300 bg-yellow-400/20"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            </>
          ) : null}

          {lendo ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-300" />
            </div>
          ) : null}

          {!temSelecao && !lendo ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <span className="rounded-full border border-yellow-400/40 bg-black/80 px-4 py-2 text-xs font-medium text-yellow-100">
                Arraste em cima do número
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {textoLido ? (
          <p className="text-center text-lg font-semibold tabular-nums text-yellow-100">{textoLido}</p>
        ) : null}
        {copiado ? (
          <p className="text-center text-xs text-emerald-300">Copiado — cole no campo de leitura.</p>
        ) : null}
        {erro ? <p className="text-center text-xs text-amber-400">{erro}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={lendo || !temSelecao}
            onClick={() => void copiarSelecao()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              temSelecao ? "bg-primary-neon text-slate-900" : "bg-slate-800 text-slate-500"
            )}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {lendo ? "Lendo…" : copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={lendo || !temSelecao}
            onClick={limparSelecao}
            className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type Props = {
  file: File;
  previewUrl: string;
  className?: string;
};

export function FotoLeituraSegurar({ file, previewUrl, className }: Props) {
  const [seletorAberto, setSeletorAberto] = useState(false);

  useEffect(() => {
    setSeletorAberto(true);
  }, [file, previewUrl]);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <button
        type="button"
        onClick={() => setSeletorAberto(true)}
        className="relative block w-full overflow-hidden rounded-xl border border-slate-700 bg-black text-left"
        aria-label="Abrir foto para selecionar número"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Foto da coleta"
          className="block w-full h-auto"
          draggable={false}
        />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-medium text-yellow-100">
          <Maximize2 className="h-3 w-3" />
          Selecionar número
        </span>
      </button>

      <p className="text-center text-[11px] text-slate-500">
        Toque na foto → arraste no número → Copiar → cole no campo
      </p>

      <SeletorFullscreen
        file={file}
        previewUrl={previewUrl}
        aberto={seletorAberto}
        onFechar={() => setSeletorAberto(false)}
      />
    </div>
  );
}
