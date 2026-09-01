"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, ZoomIn } from "lucide-react";
import { cropFileByPixelRect } from "@/lib/ia/crop-image";
import {
  getFotoImageLayout,
  pixelRectParaDisplay,
  pontoDisplayParaRecorte,
} from "@/lib/ia/foto-image-layout";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 480;
const MOVE_CANCEL_PX = 14;

type SelecaoVisivel = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  numero: string | null;
};

type Props = {
  file: File;
  previewUrl: string;
  modo: "contador" | "entrada_saida";
  onContador?: (valor: string) => void;
  onEntrada?: (valor: string) => void;
  onSaida?: (valor: string) => void;
  entradaPreenchida?: boolean;
  saidaPreenchida?: boolean;
  className?: string;
};

function resolverCampo(
  modo: Props["modo"],
  entradaPreenchida: boolean,
  saidaPreenchida: boolean
): "entrada" | "saida" | "contador" {
  if (modo === "contador") return "contador";
  if (!entradaPreenchida) return "entrada";
  if (!saidaPreenchida) return "saida";
  return "entrada";
}

type AreaProps = {
  previewUrl: string;
  selecoes: SelecaoVisivel[];
  lendo: boolean;
  modo: Props["modo"];
  entradaPreenchida: boolean;
  saidaPreenchida: boolean;
  onLongPress: (
    clientX: number,
    clientY: number,
    container: HTMLDivElement,
    img: HTMLImageElement
  ) => void;
  onTap: () => void;
  className?: string;
  minHeight?: string;
};

function AreaFotoToque({
  previewUrl,
  selecoes,
  lendo,
  modo,
  entradaPreenchida,
  saidaPreenchida,
  onLongPress,
  onTap,
  className,
  minHeight = "220px",
}: AreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressRef = useRef(false);
  const [, setLayoutTick] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function limparTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (lendo) return;
    e.preventDefault();
    longPressRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    limparTimer();
    timerRef.current = window.setTimeout(() => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;
      longPressRef.current = true;
      onLongPress(e.clientX, e.clientY, container, img);
    }, LONG_PRESS_MS);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) limparTimer();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    limparTimer();
    if (!longPressRef.current && startRef.current) onTap();
    startRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border-2 border-slate-700 bg-black cursor-zoom-in",
        className
      )}
      style={{
        minHeight,
        touchAction: "manipulation",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
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
        alt="Foto da coleta"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />

      {selecoes.map((sel) => (
        <div
          key={sel.id}
          className="pointer-events-none absolute z-10 rounded-md border-[3px] border-yellow-300 bg-yellow-400/30 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
          style={{
            left: sel.left,
            top: sel.top,
            width: sel.width,
            height: sel.height,
          }}
        >
          {sel.numero ? (
            <span className="absolute -top-7 left-0 max-w-[min(100%,160px)] truncate rounded-md bg-yellow-300 px-2 py-0.5 text-[11px] font-bold text-slate-900 tabular-nums shadow">
              {sel.numero}
            </span>
          ) : null}
        </div>
      ))}

      {lendo ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <Loader2 className="h-7 w-7 animate-spin text-yellow-300" />
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center px-3">
        <span className="rounded-full bg-black/75 px-3 py-1 text-[10px] text-slate-200 text-center">
          Toque = zoom · Segure no número = selecionar
          {modo === "entrada_saida"
            ? ` (${!entradaPreenchida ? "próximo: entrada" : !saidaPreenchida ? "próximo: saída" : "entrada/saída"})`
            : ""}
        </span>
      </div>
    </div>
  );
}

export function FotoLeituraSegurar({
  file,
  previewUrl,
  modo,
  onContador,
  onEntrada,
  onSaida,
  entradaPreenchida = false,
  saidaPreenchida = false,
  className,
}: Props) {
  const [zoomAberto, setZoomAberto] = useState(false);
  const [selecoes, setSelecoes] = useState<SelecaoVisivel[]>([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    setSelecoes([]);
    setErro(null);
    setMensagem(null);
  }, [file, previewUrl]);

  useEffect(() => {
    if (!zoomAberto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomAberto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [zoomAberto]);

  const lerNoPonto = useCallback(
    async (
      clientX: number,
      clientY: number,
      container: HTMLDivElement,
      img: HTMLImageElement
    ) => {
      if (!img.naturalWidth || !img.naturalHeight) return;

      const bounds = container.getBoundingClientRect();
      const layout = getFotoImageLayout(
        img.naturalWidth,
        img.naturalHeight,
        bounds.width,
        bounds.height
      );
      const pixelRect = pontoDisplayParaRecorte(
        clientX,
        clientY,
        bounds,
        layout,
        img.naturalWidth,
        img.naturalHeight
      );
      if (!pixelRect) {
        setErro("Segure em cima do número na foto.");
        return;
      }

      const displayRect = pixelRectParaDisplay(pixelRect, layout);
      const selId = `sel-${Date.now()}`;
      setSelecoes((prev) => [...prev, { id: selId, ...displayRect, numero: null }]);
      setLendo(true);
      setErro(null);

      try {
        const recorte = await cropFileByPixelRect(file, pixelRect, "leitura-ponto.jpg");
        const form = new FormData();
        form.append("foto", recorte);
        form.append("modo", "contador");

        const res = await fetch("/api/equipamentos/ler-numero-foto", {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as { error?: string; numero?: string };
        if (!res.ok || !json.numero?.trim()) {
          setSelecoes((prev) => prev.filter((s) => s.id !== selId));
          setErro(json.error || "Não leu esse trecho. Segure bem em cima do número.");
          return;
        }

        const numero = json.numero.trim();
        setSelecoes((prev) =>
          prev.map((s) => (s.id === selId ? { ...s, numero } : s))
        );

        const campo = resolverCampo(modo, entradaPreenchida, saidaPreenchida);
        if (campo === "entrada") {
          onEntrada?.(numero);
          setMensagem(`${numero} → entrada`);
        } else if (campo === "saida") {
          onSaida?.(numero);
          setMensagem(`${numero} → saída`);
        } else {
          onContador?.(numero);
          setMensagem(`${numero} colocado no campo`);
        }
      } catch {
        setSelecoes((prev) => prev.filter((s) => s.id !== selId));
        setErro("Erro ao ler o trecho selecionado.");
      } finally {
        setLendo(false);
      }
    },
    [file, modo, onContador, onEntrada, onSaida, entradaPreenchida, saidaPreenchida]
  );

  const areaComum = {
    previewUrl,
    selecoes,
    lendo,
    modo,
    entradaPreenchida,
    saidaPreenchida,
    onTap: () => setZoomAberto(true),
    onLongPress: (x: number, y: number, c: HTMLDivElement, i: HTMLImageElement) => {
      void lerNoPonto(x, y, c, i);
    },
  };

  return (
    <div className={cn("space-y-2", className)}>
      <AreaFotoToque {...areaComum} />

      {mensagem ? <p className="text-xs font-medium text-emerald-300">{mensagem}</p> : null}
      {erro ? <p className="text-xs text-amber-400">{erro}</p> : null}

      {zoomAberto
        ? createPortal(
            <div
              className="fixed inset-0 z-[12000] flex flex-col bg-black/95"
              role="dialog"
              aria-modal="true"
              aria-label="Zoom da foto"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <ZoomIn className="h-4 w-4" />
                  Segure no número para selecionar
                </p>
                <button
                  type="button"
                  onClick={() => setZoomAberto(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar zoom"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 p-3">
                <AreaFotoToque
                  {...areaComum}
                  minHeight="100%"
                  className="h-full max-h-[calc(100vh-80px)]"
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
