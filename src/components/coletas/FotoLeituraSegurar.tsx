"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, Minus, Plus, X, ZoomOut } from "lucide-react";
import { cropAndCompressForOcr, type PixelRect } from "@/lib/ia/crop-image";
import { lerDigitosRecorteLocal, preaquecerOcrLocal } from "@/lib/ia/ocr-recorte-local";
import { formatContadorInput } from "@/lib/nichos/cassino/contadores";
import {
  displayRectParaPixelRect,
  getFotoImageLayoutFromElement,
} from "@/lib/ia/foto-image-layout";
import { cn } from "@/lib/utils";

type DisplayRect = { x: number; y: number; width: number; height: number };

const ZOOM_MAX = 5;
const ZOOM_STEP = 0.5;
const LIMIAR_SELECAO_PX = 10;

function normalizeRect(x1: number, y1: number, x2: number, y2: number): DisplayRect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function distanciaDedos(touches: TouchList | { x: number; y: number }[]) {
  if (touches.length < 2) return null;
  const a = touches[0];
  const b = touches[1];
  const ax = "clientX" in a ? a.clientX : a.x;
  const ay = "clientY" in a ? a.clientY : a.y;
  const bx = "clientX" in b ? b.clientX : b.x;
  const by = "clientY" in b ? b.clientY : b.y;
  return {
    dist: Math.max(1, Math.hypot(ax - bx, ay - by)),
    meioX: (ax + bx) / 2,
    meioY: (ay + by) / 2,
  };
}

type SeletorProps = {
  file: File;
  previewUrl: string;
  aberto: boolean;
  onFechar: () => void;
};

function SeletorManualFullscreen({ file, previewUrl, aberto, onFechar }: SeletorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const baseWidthRef = useRef(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rectRef = useRef<DisplayRect | null>(null);
  const pontosRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    dist: number;
    zoom: number;
    normX: number;
    normY: number;
  } | null>(null);
  const zoomRef = useRef(1);
  const modoRef = useRef<"idle" | "pending" | "select" | "pinch">("idle");
  const pointerCapturadoRef = useRef<number | null>(null);
  const toquesAtivosRef = useRef(0);

  const [zoom, setZoom] = useState(1);
  const [arrastando, setArrastando] = useState(false);
  const [rectTemp, setRectTemp] = useState<DisplayRect | null>(null);
  const [selecao, setSelecao] = useState<DisplayRect | null>(null);
  const [pixelRect, setPixelRect] = useState<PixelRect | null>(null);
  const [lendo, setLendo] = useState(false);
  const [textoLido, setTextoLido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lendoRef = useRef(false);

  useEffect(() => {
    if (aberto) return;
    setArrastando(false);
    setRectTemp(null);
    setSelecao(null);
    setPixelRect(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
    lendoRef.current = false;
    startRef.current = null;
    rectRef.current = null;
    pontosRef.current.clear();
    pinchRef.current = null;
    modoRef.current = "idle";
    pointerCapturadoRef.current = null;
    toquesAtivosRef.current = 0;
    zoomRef.current = 1;
    baseWidthRef.current = 0;
    setZoom(1);
  }, [aberto]);

  const aplicarLarguraZoom = useCallback((zoomAlvo: number) => {
    const img = imgRef.current;
    const base = baseWidthRef.current;
    if (!img || base <= 0) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(1, zoomAlvo));
    zoomRef.current = clamped;
    img.style.width = `${base * clamped}px`;
    img.style.maxWidth = "none";
    setZoom(clamped);
  }, []);

  const sincronizarBase = useCallback(() => {
    const scroller = scrollRef.current;
    const img = imgRef.current;
    if (!scroller || !img || !img.naturalWidth) return false;
    baseWidthRef.current = scroller.clientWidth;
    aplicarLarguraZoom(zoomRef.current);
    return true;
  }, [aplicarLarguraZoom]);

  useEffect(() => {
    if (!aberto) return;
    const id = window.requestAnimationFrame(() => {
      sincronizarBase();
    });
    window.addEventListener("resize", sincronizarBase);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", sincronizarBase);
    };
  }, [aberto, previewUrl, sincronizarBase]);

  useEffect(() => {
    if (!aberto) return;
    preaquecerOcrLocal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [aberto]);

  const calcularPixelRect = useCallback((rect: DisplayRect) => {
    const img = imgRef.current;
    if (!img) return null;
    const layout = getFotoImageLayoutFromElement(img);
    if (!layout) return null;
    return displayRectParaPixelRect(rect, layout);
  }, []);

  const copiarSelecao = useCallback(
    async (px?: PixelRect | null) => {
      const alvo = px ?? pixelRect;
      if (!alvo) {
        setErro("Arraste em cima do grupo de números que quer copiar.");
        return;
      }
      if (lendoRef.current) return;
      lendoRef.current = true;
      setLendo(true);
      setErro(null);
      setCopiado(false);
      try {
        const recorte = await cropAndCompressForOcr(file, alvo);

        const digitosLocal = await lerDigitosRecorteLocal(recorte);
        if (digitosLocal) {
          const numero = formatContadorInput(digitosLocal);
          setTextoLido(numero);
          void navigator.clipboard.writeText(numero);
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2500);
          return;
        }

        const form = new FormData();
        form.append("foto", recorte);
        form.append("modo", "contador");
        form.append("rapido", "1");
        const res = await fetch("/api/equipamentos/ler-numero-foto", {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as { error?: string; numero?: string };
        if (!res.ok || !json.numero?.trim()) {
          setErro(json.error || "Não leu esse trecho. Marque de novo só o grupo de números.");
          return;
        }
        const numero = json.numero.trim();
        setTextoLido(numero);
        void navigator.clipboard.writeText(numero);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2500);
      } catch {
        setErro("Não foi possível copiar. Tente marcar de novo.");
      } finally {
        lendoRef.current = false;
        setLendo(false);
      }
    },
    [file, pixelRect]
  );

  function pontoLocal(clientX: number, clientY: number) {
    const img = imgRef.current;
    if (!img) return null;
    const bounds = img.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function moverPara(
    zoomAlvo: number,
    normX: number,
    normY: number,
    telaX: number,
    telaY: number
  ) {
    if (baseWidthRef.current <= 0) sincronizarBase();
    const scroller = scrollRef.current;
    const img = imgRef.current;
    const base = baseWidthRef.current;
    if (!scroller || !img || base <= 0) return;

    aplicarLarguraZoom(zoomAlvo);

    const displayX = normX * base * zoomRef.current;
    const displayY = normY * img.clientHeight;
    const bounds = scroller.getBoundingClientRect();
    scroller.scrollLeft = Math.max(0, displayX - (telaX - bounds.left));
    scroller.scrollTop = Math.max(0, displayY - (telaY - bounds.top));
  }

  function resetarZoom() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    aplicarLarguraZoom(1);
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
  }

  function ajustarZoom(delta: number, centroTela = true) {
    if (baseWidthRef.current <= 0 && !sincronizarBase()) return;
    const scroller = scrollRef.current;
    const img = imgRef.current;
    if (!scroller || !img) return;
    const bounds = scroller.getBoundingClientRect();
    const telaX = bounds.left + bounds.width / 2;
    const telaY = bounds.top + bounds.height / 2;
    const imgBounds = img.getBoundingClientRect();
    const normX = Math.min(1, Math.max(0, (telaX - imgBounds.left) / Math.max(1, imgBounds.width)));
    const normY = Math.min(1, Math.max(0, (telaY - imgBounds.top) / Math.max(1, imgBounds.height)));
    moverPara(zoomRef.current + delta, normX, normY, telaX, telaY);
  }

  function abortarArrasto() {
    startRef.current = null;
    rectRef.current = null;
    setArrastando(false);
    setRectTemp(null);
    if (modoRef.current === "pending" || modoRef.current === "select") {
      modoRef.current = "idle";
    }
  }

  function liberarCaptura(target: HTMLDivElement) {
    const id = pointerCapturadoRef.current;
    if (id == null) return;
    try {
      if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    } catch {
      /* ignore */
    }
    pointerCapturadoRef.current = null;
  }

  function iniciarPinch(meioX: number, meioY: number, dist: number) {
    if (baseWidthRef.current <= 0 && !sincronizarBase()) return;
    const img = imgRef.current;
    const base = baseWidthRef.current;
    if (!img || base <= 0 || dist <= 0) return;
    const bounds = img.getBoundingClientRect();
    const localX = meioX - bounds.left;
    const localY = meioY - bounds.top;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    if (displayW <= 0 || displayH <= 0) return;
    pinchRef.current = {
      dist,
      zoom: zoomRef.current,
      normX: localX / displayW,
      normY: localY / displayH,
    };
    modoRef.current = "pinch";
  }

  function aplicarPinch(meioX: number, meioY: number, dist: number) {
    const inicio = pinchRef.current;
    if (!inicio || dist <= 0) return;
    const alvo = Math.min(ZOOM_MAX, Math.max(1, (inicio.zoom * dist) / inicio.dist));
    moverPara(alvo, inicio.normX, inicio.normY, meioX, meioY);
  }

  function entrarPinch(meioX: number, meioY: number, dist: number, target: HTMLDivElement) {
    liberarCaptura(target);
    abortarArrasto();
    setSelecao(null);
    setPixelRect(null);
    setTextoLido(null);
    setCopiado(false);
    iniciarPinch(meioX, meioY, dist);
  }

  function doisDedosPointer() {
    const pts = [...pontosRef.current.values()];
    return distanciaDedos(pts);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (lendo) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    pontosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (toquesAtivosRef.current >= 2 || pontosRef.current.size >= 2) {
      e.preventDefault();
      const g = doisDedosPointer();
      if (g) entrarPinch(g.meioX, g.meioY, g.dist, e.currentTarget);
      return;
    }

    if (modoRef.current === "pinch") return;

    e.preventDefault();
    const p = pontoLocal(e.clientX, e.clientY);
    if (!p) return;
    setErro(null);
    setTextoLido(null);
    setCopiado(false);
    setSelecao(null);
    setPixelRect(null);
    startRef.current = p;
    modoRef.current = "pending";
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pontosRef.current.has(e.pointerId)) return;
    pontosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pontosRef.current.size >= 2 || toquesAtivosRef.current >= 2) {
      e.preventDefault();
      const g = doisDedosPointer();
      if (!g) return;
      if (modoRef.current !== "pinch") {
        entrarPinch(g.meioX, g.meioY, g.dist, e.currentTarget);
      } else {
        aplicarPinch(g.meioX, g.meioY, g.dist);
      }
      return;
    }

    if (modoRef.current === "pinch") return;
    if (!startRef.current) return;

    e.preventDefault();
    const p = pontoLocal(e.clientX, e.clientY);
    if (!p) return;

    const dx = p.x - startRef.current.x;
    const dy = p.y - startRef.current.y;
    if (modoRef.current === "pending") {
      if (Math.hypot(dx, dy) < LIMIAR_SELECAO_PX) return;
      modoRef.current = "select";
      setArrastando(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerCapturadoRef.current = e.pointerId;
      } catch {
        /* ignore */
      }
    }

    const r = normalizeRect(startRef.current.x, startRef.current.y, p.x, p.y);
    setRectTemp(r);
    rectRef.current = r;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pontosRef.current.delete(e.pointerId);
    liberarCaptura(e.currentTarget);

    if (modoRef.current === "pinch") {
      if (pontosRef.current.size < 2 && toquesAtivosRef.current < 2) {
        pinchRef.current = null;
        modoRef.current = "idle";
      }
      return;
    }

    if (modoRef.current === "pending") {
      modoRef.current = "idle";
      startRef.current = null;
      return;
    }

    if (!arrastando) {
      modoRef.current = "idle";
      return;
    }

    e.preventDefault();
    setArrastando(false);
    modoRef.current = "idle";
    startRef.current = null;
    const final = rectRef.current;

    const minimo = 12;
    if (!final || final.width < minimo || final.height < minimo) {
      setRectTemp(null);
      rectRef.current = null;
      return;
    }
    const px = calcularPixelRect(final);
    if (!px) {
      setErro("Marque em cima do grupo de números.");
      setRectTemp(null);
      rectRef.current = null;
      return;
    }
    setSelecao(final);
    setPixelRect(px);
    setRectTemp(null);
    rectRef.current = null;
    setTextoLido(null);
    void copiarSelecao(px);
  }

  function limparSelecao() {
    setSelecao(null);
    setPixelRect(null);
    setRectTemp(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!aberto || !root) return;

    function onTouchStart(ev: TouchEvent) {
      toquesAtivosRef.current = ev.touches.length;
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      ev.stopPropagation();
      const g = distanciaDedos(ev.touches);
      if (!g) return;
      const pinchTarget = scrollRef.current ?? root;
      if (!pinchTarget) return;
      entrarPinch(g.meioX, g.meioY, g.dist, pinchTarget);
    }

    function onTouchMove(ev: TouchEvent) {
      toquesAtivosRef.current = ev.touches.length;
      if (ev.touches.length < 2 || !pinchRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const g = distanciaDedos(ev.touches);
      if (g) aplicarPinch(g.meioX, g.meioY, g.dist);
    }

    function onTouchEnd(ev: TouchEvent) {
      toquesAtivosRef.current = ev.touches.length;
      if (ev.touches.length < 2) {
        pinchRef.current = null;
        if (ev.touches.length === 0) modoRef.current = "idle";
      }
    }

    root.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    root.addEventListener("touchend", onTouchEnd, { capture: true });
    root.addEventListener("touchcancel", onTouchEnd, { capture: true });
    return () => {
      root.removeEventListener("touchstart", onTouchStart, { capture: true });
      root.removeEventListener("touchmove", onTouchMove, { capture: true });
      root.removeEventListener("touchend", onTouchEnd, { capture: true });
      root.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [aberto]);

  if (!aberto) return null;

  const rectExibir = arrastando ? rectTemp : selecao;
  const minimoVisivel = 8;
  const temMarcacao = Boolean(
    rectExibir && rectExibir.width > minimoVisivel && rectExibir.height > minimoVisivel
  );

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[12000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-at-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Marque o grupo de números</p>
          <p className="text-xs text-at-muted">
            Arraste nos dígitos e solte — copia automaticamente. Dois dedos ou botões +/− dão zoom.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 rounded-full p-2 text-at-muted hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto overscroll-contain"
          style={{ touchAction: "none", WebkitOverflowScrolling: "touch" }}
        >
          <div
            className="relative inline-block min-w-full touch-none select-none"
            style={{ touchAction: "none", WebkitUserSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Foto para selecionar número"
              className="block h-auto w-full"
              draggable={false}
              onLoad={() => sincronizarBase()}
            />

            {temMarcacao && rectExibir ? (
              <div
                className="pointer-events-none absolute border-2 border-yellow-300"
                style={{
                  left: rectExibir.x,
                  top: rectExibir.y,
                  width: rectExibir.width,
                  height: rectExibir.height,
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => ajustarZoom(ZOOM_STEP)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-at-soft bg-black/80 text-white"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => ajustarZoom(-ZOOM_STEP)}
            disabled={zoom <= 1.01}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-at-soft bg-black/80 text-white disabled:opacity-40"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-5 w-5" />
          </button>
          {zoom > 1.01 ? (
            <button
              type="button"
              onClick={resetarZoom}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-at-soft bg-black/80 px-3 py-2 text-xs font-medium text-yellow-100"
            >
              <ZoomOut className="h-3.5 w-3.5" />
              {zoom.toFixed(1)}×
            </button>
          ) : null}
        </div>

        {lendo ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-300" />
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-at-soft px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {textoLido ? (
          <p className="text-center text-xl font-semibold tabular-nums text-yellow-100">{textoLido}</p>
        ) : null}
        {copiado ? (
          <p className="text-center text-xs text-emerald-300">Copiado — cole no campo de leitura.</p>
        ) : null}
        {erro ? <p className="text-center text-xs text-amber-400">{erro}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={lendo || !pixelRect}
            onClick={() => void copiarSelecao()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              pixelRect ? "bg-primary-neon text-slate-900" : "bg-slate-800 text-at-muted"
            )}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {lendo ? "Lendo…" : copiado ? "Copiado!" : "Copiar de novo"}
          </button>
          <button
            type="button"
            disabled={lendo || !selecao}
            onClick={limparSelecao}
            className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-4 py-3 text-sm text-at-primary/90 hover:bg-slate-800 disabled:opacity-50"
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
  modo?: "contador" | "entrada_saida";
  className?: string;
};

export function FotoLeituraSegurar({ file, previewUrl, className }: Props) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    preaquecerOcrLocal();
  }, [file, previewUrl]);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="block w-full overflow-hidden rounded-xl border border-slate-700 bg-black text-left touch-manipulation"
        aria-label="Abrir foto em tamanho grande"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Foto da coleta"
          className="block w-full h-auto"
          draggable={false}
        />
      </button>

      <p className="text-center text-[11px] text-at-muted">
        Toque na foto → marque o grupo → solte (copia sozinho) → cole no campo. Pinça com dois dedos
        ou use +/− para zoom.
      </p>

      <SeletorManualFullscreen
        file={file}
        previewUrl={previewUrl}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      />
    </div>
  );
}
