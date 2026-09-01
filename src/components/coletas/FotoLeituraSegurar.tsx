"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, Maximize2, RefreshCw, X } from "lucide-react";
import {
  boxNormalizadaParaDisplay,
  getFotoImageLayout,
  type FotoImageLayout,
} from "@/lib/ia/foto-image-layout";
import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";
import { cn } from "@/lib/utils";

type NumeroDetectado = {
  id: string;
  numero: string;
  numeroRaw: string;
  rotulo: string | null;
  tipo: "entrada" | "saida" | "contador" | "outro";
  box: CaixaNormalizada;
  confianca: number;
};

const TIPO_LABEL: Record<NumeroDetectado["tipo"], string> = {
  entrada: "Entrada",
  saida: "Saída",
  contador: "Contador",
  outro: "Número",
};

const TIPO_COR: Record<NumeroDetectado["tipo"], string> = {
  entrada: "border-cyan-400 bg-cyan-400/15 hover:bg-cyan-400/25",
  saida: "border-violet-400 bg-violet-400/15 hover:bg-violet-400/25",
  contador: "border-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25",
  outro: "border-slate-400 bg-slate-400/10 hover:bg-slate-400/20",
};

type SeletorProps = {
  file: File;
  previewUrl: string;
  aberto: boolean;
  onFechar: () => void;
};

function SeletorNumerosDetectados({ file, previewUrl, aberto, onFechar }: SeletorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<FotoImageLayout | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [numeros, setNumeros] = useState<NumeroDetectado[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const selecionado = numeros.find((n) => n.id === selecionadoId) ?? null;

  const recalcularLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const bounds = container.getBoundingClientRect();
    setLayout(
      getFotoImageLayout(img.naturalWidth, img.naturalHeight, bounds.width, bounds.height)
    );
  }, []);

  const detectarNumeros = useCallback(async () => {
    setDetectando(true);
    setErro(null);
    setNumeros([]);
    setSelecionadoId(null);
    setCopiado(false);
    try {
      const form = new FormData();
      form.append("foto", file);
      const res = await fetch("/api/equipamentos/localizar-numeros-foto", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        error?: string;
        numeros?: Array<{
          id: string;
          numero: string;
          numero_raw: string;
          rotulo: string | null;
          tipo: NumeroDetectado["tipo"];
          box: CaixaNormalizada;
          confianca: number;
        }>;
      };
      if (!res.ok || !json.numeros?.length) {
        setErro(json.error || "Não encontrou números na foto. Tente outra foto ou mais perto.");
        return;
      }
      const lista = json.numeros.map((n) => ({
        id: n.id,
        numero: n.numero,
        numeroRaw: n.numero_raw,
        rotulo: n.rotulo,
        tipo: n.tipo ?? "contador",
        box: n.box,
        confianca: n.confianca ?? 0.6,
      }));
      setNumeros(lista);
      if (lista.length === 1) setSelecionadoId(lista[0].id);
    } catch {
      setErro("Não foi possível analisar a foto. Verifique a conexão e tente de novo.");
    } finally {
      setDetectando(false);
    }
  }, [file]);

  useEffect(() => {
    if (!aberto) return;
    setNumeros([]);
    setSelecionadoId(null);
    setErro(null);
    setCopiado(false);
    void detectarNumeros();
  }, [aberto, previewUrl, detectarNumeros]);

  useEffect(() => {
    if (!aberto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
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

  async function copiarSelecionado() {
    if (!selecionado) {
      setErro("Toque em um número na foto ou na lista.");
      return;
    }
    try {
      await navigator.clipboard.writeText(selecionado.numero);
      setCopiado(true);
      setErro(null);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Segure o número e copie manualmente.");
    }
  }

  function selecionar(id: string) {
    setSelecionadoId(id);
    setCopiado(false);
    setErro(null);
  }

  if (!aberto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Números na foto</p>
          <p className="text-xs text-slate-400">
            Toque no número que quer · Copiar · cole no campo
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

      <div className="relative min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <div
          ref={containerRef}
          className="relative mx-auto h-[min(52vh,480px)] w-full overflow-hidden rounded-xl border border-slate-700 bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={previewUrl}
            alt="Foto com números detectados"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
            onLoad={recalcularLayout}
          />

          {detectando ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="h-9 w-9 animate-spin text-yellow-300" />
              <p className="text-sm text-slate-200">Identificando números…</p>
            </div>
          ) : null}

          {layout && !detectando
            ? numeros.map((item) => {
                const box = boxNormalizadaParaDisplay(item.box, layout);
                const ativo = item.id === selecionadoId;
                const pad = 4;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selecionar(item.id)}
                    className={cn(
                      "absolute z-10 min-h-[36px] min-w-[48px] rounded border-2 transition",
                      ativo
                        ? "z-20 border-emerald-300 bg-emerald-400/30 ring-2 ring-emerald-200/80"
                        : TIPO_COR[item.tipo]
                    )}
                    style={{
                      left: Math.max(0, box.left - pad),
                      top: Math.max(0, box.top - pad),
                      width: box.width + pad * 2,
                      height: box.height + pad * 2,
                    }}
                    aria-label={`${item.rotulo ?? TIPO_LABEL[item.tipo]}: ${item.numero}`}
                    aria-pressed={ativo}
                  >
                    {box.height >= 28 ? (
                      <span className="pointer-events-none block truncate px-1 text-[10px] font-semibold tabular-nums text-white drop-shadow">
                        {item.numero}
                      </span>
                    ) : null}
                  </button>
                );
              })
            : null}
        </div>

        {!detectando && numeros.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">Ou escolha na lista:</p>
            <div className="flex flex-wrap gap-2">
              {numeros.map((item) => {
                const ativo = item.id === selecionadoId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selecionar(item.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition",
                      ativo
                        ? "border-emerald-400 bg-emerald-500/15"
                        : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
                    )}
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                      {item.rotulo ?? TIPO_LABEL[item.tipo]}
                    </span>
                    <span className="block text-sm font-semibold tabular-nums text-white">
                      {item.numero}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {selecionado ? (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              {selecionado.rotulo ?? TIPO_LABEL[selecionado.tipo]}
            </p>
            <p className="text-xl font-semibold tabular-nums text-yellow-100">{selecionado.numero}</p>
          </div>
        ) : null}

        {copiado ? (
          <p className="text-center text-xs text-emerald-300">Copiado — cole no campo de leitura.</p>
        ) : null}
        {erro ? <p className="text-center text-xs text-amber-400">{erro}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={detectando || !selecionado}
            onClick={() => void copiarSelecionado()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              selecionado ? "bg-primary-neon text-slate-900" : "bg-slate-800 text-slate-500"
            )}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={detectando}
            onClick={() => void detectarNumeros()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", detectando && "animate-spin")} />
            Redetectar
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
        aria-label="Abrir foto e escolher número detectado"
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
          Escolher número
        </span>
      </button>

      <p className="text-center text-[11px] text-slate-500">
        A IA marca os números — toque no que quer, Copiar e cole no campo
      </p>

      <SeletorNumerosDetectados
        file={file}
        previewUrl={previewUrl}
        aberto={seletorAberto}
        onFechar={() => setSeletorAberto(false)}
      />
    </div>
  );
}
