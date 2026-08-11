
"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  MapPin,
  Navigation,
  Package,
  SkipForward,
} from "lucide-react";
import { PontoFuraAlertas } from "@/components/coletas/fura-fura/PontoFuraAlertas";
import { PontoChamadosAlertas } from "@/components/chamados/PontoChamadosAlertas";
import { linksNavegacaoPonto } from "@/lib/nichos/fura-fura";
import type { ParadaRota } from "@/lib/rotas/otimizar-rota";
import { statusParadaLabel } from "@/lib/rotas/rotas-salvas";
import type { PontoRotaEnriquecido } from "@/components/rotas/RotaInteligenteClient";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  paradas: ParadaRota[];
  pontos: PontoRotaEnriquecido[];
  paradaAtiva: string | null;
  onHoverParada: (id: string | null) => void;
  onMover: (index: number, direcao: "up" | "down") => void;
  somenteLeitura?: boolean;
};

export function ParadasOrdenaveisList({
  paradas,
  pontos,
  paradaAtiva,
  onHoverParada,
  onMover,
  somenteLeitura,
}: Props) {
  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {paradas.map((parada, index) => {
        const pontoOriginal = pontos.find((p) => p.id === parada.id);
        const nav = pontoOriginal ? linksNavegacaoPonto(pontoOriginal) : null;
        const ativo = paradaAtiva === parada.id;
        const concluida =
          parada.statusParada === "concluida" || parada.statusParada === "pulada";
        const bloqueada = concluida || somenteLeitura;
        const chamadosPonto = pontoOriginal?.chamadosAbertos ?? [];
        const temManutencao = chamadosPonto.length > 0;

        return (
          <div
            key={parada.id}
            id={`parada-${parada.id}`}
            className={cn(
              "glass-card p-4 space-y-3 transition",
              ativo && "ring-1 ring-primary-neon/50",
              !parada.temCoordenadas && "opacity-80",
              concluida && "opacity-60 border-green-500/20",
              temManutencao && !concluida && "border-orange-500/25"
            )}
            onMouseEnter={() => onHoverParada(parada.id)}
          >
            <div className="flex gap-2">
              {!somenteLeitura && (
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                  <GripVertical className="h-4 w-4 text-slate-600" />
                  <button
                    type="button"
                    disabled={bloqueada || index === 0 || paradaConcluida(paradas[index - 1])}
                    onClick={() => onMover(index, "up")}
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                    title="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      bloqueada ||
                      index === paradas.length - 1 ||
                      paradaConcluida(paradas[index + 1])
                    }
                    onClick={() => onMover(index, "down")}
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                    title="Descer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  concluida
                    ? "bg-green-500/20 text-green-400"
                    : "bg-amber-500/20 text-amber-400"
                )}
              >
                {concluida ? <CheckCircle2 className="h-4 w-4" /> : parada.ordem}
              </span>

              {parada.fotoUrl ? (
                <img
                  src={parada.fotoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-600">
                  <MapPin className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">{parada.nome}</p>
                  {parada.statusParada && parada.statusParada !== "pendente" && (
                    <span
                      className={cn(
                        "text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
                        parada.statusParada === "concluida"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-500/20 text-slate-400"
                      )}
                    >
                      {statusParadaLabel(parada.statusParada)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {[parada.endereco, parada.cidade].filter(Boolean).join(" · ") ||
                    "Sem endereço — ok para checklist da rota"}
                </p>
                {parada.distanciaAnteriorKm != null && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    +{parada.distanciaAnteriorKm.toFixed(1)} km da parada anterior
                  </p>
                )}
                {(parada.pendente ?? 0) > 0.009 && !concluida && (
                  <p className="text-xs font-medium text-amber-400 mt-1">
                    Deve {formatCurrency(parada.pendente!)}
                  </p>
                )}
                {temManutencao && !concluida && (
                  <p className="text-xs font-medium text-orange-400 mt-1">
                    {chamadosPonto.length} manutenção{chamadosPonto.length === 1 ? "" : "ões"} em aberto
                  </p>
                )}
              </div>

              {!concluida && (
                <Link
                  href={`/coletas/nova?ponto=${parada.id}`}
                  className="shrink-0 self-start inline-flex items-center gap-1 rounded-lg bg-primary-neon/90 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                >
                  <Package className="h-3.5 w-3.5" />
                  Coletar
                </Link>
              )}
              {concluida && parada.statusParada === "concluida" && (
                <span className="shrink-0 self-start inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-xs font-semibold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Feito
                </span>
              )}
              {concluida && parada.statusParada === "pulada" && (
                <SkipForward className="h-4 w-4 text-slate-500 shrink-0 mt-2" />
              )}
            </div>

            {pontoOriginal && !concluida && (
              <>
                <PontoChamadosAlertas chamados={chamadosPonto} compact />
                <PontoFuraAlertas ponto={pontoOriginal} />
              </>
            )}

            {nav && !concluida && (
              <div className="flex gap-2">
                <a
                  href={nav.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-primary-neon/30"
                >
                  <Navigation className="h-3 w-3" />
                  Waze
                </a>
                <a
                  href={nav.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-primary-neon/30"
                >
                  <Navigation className="h-3 w-3" />
                  Maps
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function paradaConcluida(p: ParadaRota): boolean {
  return p.statusParada === "concluida" || p.statusParada === "pulada";
}
