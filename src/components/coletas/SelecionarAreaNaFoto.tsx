"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crop, X } from "lucide-react";
import { cropFileByPixelRect, type PixelRect } from "@/lib/ia/crop-image";
import { cn } from "@/lib/utils";

type DisplayRect = { x: number; y: number; width: number; height: number };

type ImageLayout = {
  offsetX: number;
  offsetY: number;
  displayW: number;
  displayH: number;
  scale: number;
};

type Props = {
  file: File;
  previewUrl: string;
  titulo?: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

function normalizeRect(x1: number, y1: number, x2: number, y2: number): DisplayRect {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  return { x, y, width, height };
}

function getImageLayout(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number
): ImageLayout {
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const displayW = naturalWidth * scale;
  const displayH = naturalHeight * scale;
  const offsetX = (containerWidth - displayW) / 2;
  const offsetY = (containerHeight - displayH) / 2;
  return { offsetX, offsetY, displayW, displayH, scale };
}

function displayRectToPixelRect(rect: DisplayRect, layout: ImageLayout): PixelRect | null {
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

export function SelecionarAreaNaFoto({
  file,
  previewUrl,
  titulo = "Selecione o número na foto",
  onCancel,
  onConfirm,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<ImageLayout | null>(null);
  const [rect, setRect] = useState<DisplayRect | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recalcularLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const bounds = container.getBoundingClientRect();
    setLayout(
      getImageLayout(img.naturalWidth, img.naturalHeight, bounds.width, bounds.height)
    );
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  useEffect(() => {
    recalcularLayout();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recalcularLayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalcularLayout]);

  function pontoNoContainer(clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (processando) return;
    const ponto = pontoNoContainer(e.clientX, e.clientY);
    if (!ponto) return;
    setErro(null);
    startRef.current = ponto;
    setRect({ x: ponto.x, y: ponto.y, width: 0, height: 0 });
    setArrastando(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando || !startRef.current) return;
    const ponto = pontoNoContainer(e.clientX, e.clientY);
    if (!ponto) return;
    setRect(normalizeRect(startRef.current.x, startRef.current.y, ponto.x, ponto.y));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    setArrastando(false);
    startRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  async function confirmarRecorte() {
    if (!layout || !rect) {
      setErro("Arraste na foto para marcar o número.");
      return;
    }
    const pixelRect = displayRectToPixelRect(rect, layout);
    if (!pixelRect) {
      setErro("Seleção muito pequena. Marque só o visor com o número.");
      return;
    }

    setProcessando(true);
    setErro(null);
    try {
      const recortada = await cropFileByPixelRect(file, pixelRect, "leitura-recorte.jpg");
      onConfirm(recortada, URL.createObjectURL(recortada));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível recortar a foto.");
    } finally {
      setProcessando(false);
    }
  }

  function usarFotoInteira() {
    onConfirm(file, previewUrl);
  }

  const temSelecao = Boolean(rect && rect.width > 12 && rect.height > 12);

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex flex-col bg-slate-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{titulo}</p>
          <p className="text-xs text-slate-400">
            Arraste com o dedo ou mouse em cima do número que quer ler.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 p-3 sm:p-4">
        <div
          ref={containerRef}
          className="relative mx-auto h-full max-h-[min(70vh,720px)] w-full max-w-4xl touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-black/40"
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
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
            onLoad={recalcularLayout}
          />

          {layout ? (
            <div
              className="pointer-events-none absolute border border-cyan-400/30"
              style={{
                left: layout.offsetX,
                top: layout.offsetY,
                width: layout.displayW,
                height: layout.displayH,
              }}
            />
          ) : null}

          {rect && temSelecao ? (
            <div
              className="pointer-events-none absolute border-2 border-primary-neon bg-primary-neon/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
              }}
            />
          ) : null}

          {!temSelecao ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-slate-200">
                Toque e arraste para selecionar o número
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-3">
        {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={processando || !temSelecao}
            onClick={() => void confirmarRecorte()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold sm:flex-none disabled:cursor-not-allowed disabled:opacity-50",
              temSelecao ? "bg-primary-neon text-slate-900" : "bg-slate-800 text-slate-500"
            )}
          >
            <Crop className="h-4 w-4" />
            {processando ? "Recortando…" : "Ler este trecho"}
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={usarFotoInteira}
            className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Usar foto inteira
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-400 hover:bg-slate-900 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
