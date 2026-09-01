"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  boxNormalizadaParaDisplay,
  getFotoImageLayout,
  type FotoImageLayout,
} from "@/lib/ia/foto-image-layout";
import type { NumeroDetectadoFoto } from "@/lib/ia/localizar-numeros-foto";
import { cn } from "@/lib/utils";

type NumeroApi = {
  id: string;
  numero: string;
  rotulo: string | null;
  tipo: NumeroDetectadoFoto["tipo"];
  box: NumeroDetectadoFoto["box"];
  confianca: number;
};

type Props = {
  file: File;
  previewUrl: string;
  modo: "contador" | "entrada_saida";
  onContador?: (valor: string, item: NumeroApi) => void;
  onEntrada?: (valor: string, item: NumeroApi) => void;
  onSaida?: (valor: string, item: NumeroApi) => void;
  entradaPreenchida?: boolean;
  saidaPreenchida?: boolean;
  className?: string;
};

export function FotoNumerosInterativos({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<FotoImageLayout | null>(null);
  const [numeros, setNumeros] = useState<NumeroApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const recalcularLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const bounds = container.getBoundingClientRect();
    setLayout(getFotoImageLayout(img.naturalWidth, img.naturalHeight, bounds.width, bounds.height));
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setNumeros([]);
    setSelecionadoId(null);
    setMensagem(null);

    void (async () => {
      try {
        const form = new FormData();
        form.append("foto", file);
        const res = await fetch("/api/equipamentos/localizar-numeros-foto", {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as {
          error?: string;
          numeros?: NumeroApi[];
        };
        if (cancelado) return;
        if (!res.ok) {
          setErro(json.error || "Não foi possível detectar números.");
          return;
        }
        setNumeros(json.numeros ?? []);
        if ((json.numeros ?? []).length > 0) {
          setMensagem("Toque no número que quer usar");
        }
      } catch {
        if (!cancelado) setErro("Erro ao analisar a foto.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [file]);

  useEffect(() => {
    recalcularLayout();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recalcularLayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalcularLayout, previewUrl]);

  function resolverCampo(item: NumeroApi): "entrada" | "saida" | "contador" {
    if (modo === "contador") return "contador";
    if (item.tipo === "entrada") return "entrada";
    if (item.tipo === "saida") return "saida";
    if (!entradaPreenchida) return "entrada";
    if (!saidaPreenchida) return "saida";
    return "entrada";
  }

  function selecionar(item: NumeroApi) {
    setSelecionadoId(item.id);
    const campo = resolverCampo(item);

    if (campo === "entrada") {
      onEntrada?.(item.numero, item);
      setMensagem(`${item.numero} → entrada`);
    } else if (campo === "saida") {
      onSaida?.(item.numero, item);
      setMensagem(`${item.numero} → saída`);
    } else {
      onContador?.(item.numero, item);
      setMensagem(`${item.numero} colocado no campo`);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className="relative w-full min-h-[220px] max-h-[min(52vh,420px)] overflow-hidden rounded-xl border-2 border-slate-700 bg-black"
        style={{ touchAction: "manipulation", WebkitUserSelect: "none", userSelect: "none" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={previewUrl}
          alt="Foto da coleta"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onLoad={recalcularLayout}
        />

        {carregando ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
            <p className="text-xs text-slate-200">Detectando números na foto…</p>
          </div>
        ) : null}

        {layout && !carregando
          ? numeros.map((item) => {
              const rect = boxNormalizadaParaDisplay(item.box, layout);
              const ativo = selecionadoId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selecionar(item)}
                  className={cn(
                    "absolute rounded-md border-2 transition-all",
                    ativo
                      ? "z-20 border-yellow-300 bg-yellow-400/35 shadow-[0_0_0_3px_rgba(250,204,21,0.55)]"
                      : "z-10 border-cyan-300/70 bg-cyan-400/10 hover:border-yellow-300 hover:bg-yellow-400/20"
                  )}
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: Math.max(rect.width, 28),
                    height: Math.max(rect.height, 22),
                  }}
                  aria-label={`Selecionar ${item.numero}`}
                  title={item.rotulo ? `${item.rotulo}: ${item.numero}` : item.numero}
                >
                  {ativo ? (
                    <span className="absolute -top-6 left-0 max-w-[140px] truncate rounded-md bg-yellow-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 tabular-nums shadow">
                      {item.numero}
                    </span>
                  ) : null}
                </button>
              );
            })
          : null}
      </div>

      {mensagem ? (
        <p className="text-xs font-medium text-emerald-300">{mensagem}</p>
      ) : (
        <p className="text-xs text-slate-500">
          {modo === "entrada_saida"
            ? "Toque no grupo de números — entrada primeiro, depois saída."
            : "Toque no grupo de números da leitura."}
        </p>
      )}
      {erro ? <p className="text-xs text-amber-400">{erro}</p> : null}
    </div>
  );
}
