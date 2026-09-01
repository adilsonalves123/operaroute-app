"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, X } from "lucide-react";
import { cropFileByPixelRect, type PixelRect } from "@/lib/ia/crop-image";
import {
  displayRectParaPixelRect,
  getFotoImageLayoutFromElement,
} from "@/lib/ia/foto-image-layout";
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

type SeletorProps = {
  file: File;
  previewUrl: string;
  aberto: boolean;
  onFechar: () => void;
};

function SeletorManualFullscreen({ file, previewUrl, aberto, onFechar }: SeletorProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rectRef = useRef<DisplayRect | null>(null);

  const [arrastando, setArrastando] = useState(false);
  const [rectTemp, setRectTemp] = useState<DisplayRect | null>(null);
  const [selecao, setSelecao] = useState<DisplayRect | null>(null);
  const [pixelRect, setPixelRect] = useState<PixelRect | null>(null);
  const [lendo, setLendo] = useState(false);
  const [textoLido, setTextoLido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) return;
    setArrastando(false);
    setRectTemp(null);
    setSelecao(null);
    setPixelRect(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
    startRef.current = null;
    rectRef.current = null;
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
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

  function pontoLocal(clientX: number, clientY: number) {
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (lendo) return;
    e.preventDefault();
    const p = pontoLocal(e.clientX, e.clientY);
    if (!p) return;
    setErro(null);
    setTextoLido(null);
    setCopiado(false);
    setSelecao(null);
    setPixelRect(null);
    startRef.current = p;
    const r = { x: p.x, y: p.y, width: 0, height: 0 };
    setRectTemp(r);
    rectRef.current = r;
    setArrastando(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando || !startRef.current) return;
    e.preventDefault();
    const p = pontoLocal(e.clientX, e.clientY);
    if (!p) return;
    const r = normalizeRect(startRef.current.x, startRef.current.y, p.x, p.y);
    setRectTemp(r);
    rectRef.current = r;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    e.preventDefault();
    setArrastando(false);
    startRef.current = null;
    const final = rectRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!final || final.width < 12 || final.height < 12) {
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
  }

  function limparSelecao() {
    setSelecao(null);
    setPixelRect(null);
    setRectTemp(null);
    setTextoLido(null);
    setCopiado(false);
    setErro(null);
  }

  async function copiarSelecao() {
    if (!pixelRect) {
      setErro("Arraste em cima do grupo de números que quer copiar.");
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
        setErro(json.error || "Não leu esse trecho. Marque de novo só o grupo de números.");
        return;
      }
      const numero = json.numero.trim();
      setTextoLido(numero);
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Tente marcar de novo.");
    } finally {
      setLendo(false);
    }
  }

  if (!aberto) return null;

  const rectExibir = arrastando ? rectTemp : selecao;
  const temMarcacao = Boolean(rectExibir && rectExibir.width > 8 && rectExibir.height > 8);

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Marque o grupo de números</p>
          <p className="text-xs text-slate-400">
            Arraste em cima dos dígitos · Copiar · cole no campo
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

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          ref={areaRef}
          className="relative w-full touch-none select-none"
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
            className="block w-full h-auto"
            draggable={false}
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

          {lendo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-300" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              pixelRect ? "bg-primary-neon text-slate-900" : "bg-slate-800 text-slate-500"
            )}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {lendo ? "Lendo…" : copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={lendo || !selecao}
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
  modo?: "contador" | "entrada_saida";
  className?: string;
};

export function FotoLeituraSegurar({ file, previewUrl, className }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="block w-full overflow-hidden rounded-xl border border-slate-700 bg-black text-left"
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

      <p className="text-center text-[11px] text-slate-500">
        Toque na foto → marque o grupo de números → Copiar → cole no campo
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
