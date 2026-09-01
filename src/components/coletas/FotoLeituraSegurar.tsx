"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Modo = "contador" | "entrada_saida";

const TIPO_LABEL: Record<NumeroDetectado["tipo"], string> = {
  entrada: "Entrada",
  saida: "Saída",
  contador: "Contador",
  outro: "Outros",
};

const TIPO_ORDEM: NumeroDetectado["tipo"][] = ["entrada", "saida", "contador", "outro"];

const TIPO_COR_TEXTO: Record<NumeroDetectado["tipo"], string> = {
  entrada: "text-cyan-200 hover:text-cyan-50",
  saida: "text-violet-200 hover:text-violet-50",
  contador: "text-yellow-100 hover:text-yellow-50",
  outro: "text-slate-200 hover:text-white",
};

function agruparFileiras(numeros: NumeroDetectado[]) {
  return TIPO_ORDEM.map((tipo) => ({
    tipo,
    label: TIPO_LABEL[tipo],
    items: numeros.filter((n) => n.tipo === tipo).sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x),
  })).filter((g) => g.items.length > 0);
}

function NumeroClicavel({
  item,
  ativo,
  onSelect,
  variant,
  fontSize,
  style,
}: {
  item: NumeroDetectado;
  ativo: boolean;
  onSelect: () => void;
  variant: "overlay" | "lista";
  fontSize?: number;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${item.rotulo ?? TIPO_LABEL[item.tipo]}: ${item.numero}`}
      aria-pressed={ativo}
      className={cn(
        "border-0 bg-transparent p-0 font-bold tabular-nums leading-none transition duration-150",
        variant === "overlay" ? "absolute z-10 min-h-[44px] min-w-[44px]" : "px-1 py-0.5 text-xl sm:text-2xl",
        ativo
          ? "text-yellow-300 underline decoration-yellow-300 decoration-2 underline-offset-4 [text-shadow:0_0_14px_rgba(250,204,21,0.95),0_0_4px_rgba(0,0,0,1)]"
          : cn(TIPO_COR_TEXTO[item.tipo], "[text-shadow:0_1px_4px_rgba(0,0,0,1)]")
      )}
      style={
        variant === "overlay"
          ? {
              ...style,
              fontSize: fontSize ?? 14,
            }
          : style
      }
    >
      {item.numero}
    </button>
  );
}

type SeletorProps = {
  file: File;
  previewUrl: string;
  aberto: boolean;
  modo: Modo;
  onFechar: () => void;
};

function SeletorNumerosDetectados({ file, previewUrl, aberto, modo, onFechar }: SeletorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<FotoImageLayout | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [numeros, setNumeros] = useState<NumeroDetectado[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const selecionado = numeros.find((n) => n.id === selecionadoId) ?? null;
  const fileiras = useMemo(() => agruparFileiras(numeros), [numeros]);

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
      const preferido =
        (modo === "entrada_saida" ? lista.find((n) => n.tipo === "entrada") : null) ??
        lista[0] ??
        null;
      if (preferido) setSelecionadoId(preferido.id);
    } catch {
      setErro("Não foi possível analisar a foto. Verifique a conexão e tente de novo.");
    } finally {
      setDetectando(false);
    }
  }, [file, modo]);

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
      setErro("Toque no número da entrada, saída ou contador.");
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
          <p className="text-sm font-semibold text-white">Toque no número</p>
          <p className="text-xs text-slate-400">
            Só os dígitos — sem caixa. Copiar e cole no campo.
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
          className="relative mx-auto h-[min(48vh,440px)] w-full overflow-hidden rounded-xl bg-black"
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
              <p className="text-sm text-slate-200">Identificando fileiras de números…</p>
            </div>
          ) : null}

          {layout && !detectando
            ? numeros.map((item) => {
                const box = boxNormalizadaParaDisplay(item.box, layout);
                const ativo = item.id === selecionadoId;
                const fontSize = Math.max(12, Math.min(box.height * 0.9, 32));
                return (
                  <NumeroClicavel
                    key={item.id}
                    item={item}
                    ativo={ativo}
                    onSelect={() => selecionar(item.id)}
                    variant="overlay"
                    fontSize={fontSize}
                    style={{
                      left: box.left + box.width / 2,
                      top: box.top + box.height / 2,
                      transform: `translate(-50%, -50%)${ativo ? " scale(1.06)" : ""}`,
                    }}
                  />
                );
              })
            : null}
        </div>

        {!detectando && fileiras.length > 0 ? (
          <div className="mt-4 space-y-4">
            {fileiras.map((fileira) => (
              <div key={fileira.tipo}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {fileira.label}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  {fileira.items.map((item) => (
                    <NumeroClicavel
                      key={item.id}
                      item={item}
                      ativo={item.id === selecionadoId}
                      onSelect={() => selecionar(item.id)}
                      variant="lista"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {selecionado ? (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              {selecionado.rotulo ?? TIPO_LABEL[selecionado.tipo]}
            </p>
            <p className="text-2xl font-bold tabular-nums text-yellow-100">{selecionado.numero}</p>
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
  modo?: Modo;
  className?: string;
};

export function FotoLeituraSegurar({ file, previewUrl, modo = "contador", className }: Props) {
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
        aria-label="Abrir foto e tocar nos números"
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
          Tocar nos números
        </span>
      </button>

      <p className="text-center text-[11px] text-slate-500">
        Toque só no número (entrada, saída…) · Copiar · cole no campo
      </p>

      <SeletorNumerosDetectados
        file={file}
        previewUrl={previewUrl}
        modo={modo}
        aberto={seletorAberto}
        onFechar={() => setSeletorAberto(false)}
      />
    </div>
  );
}
