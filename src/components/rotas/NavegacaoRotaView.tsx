"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronUp,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { RotaMapaAvancado } from "./RotaMapaAvancado";
import {
  buscarRotaOsrm,
  formatarDistancia,
  formatarDuracao,
  type OsrmRota,
} from "@/lib/rotas/osrm";
import { useGeolocalizacaoAoVivo } from "@/lib/rotas/use-geolocalizacao";
import { haversineKm, type Coordenada, type ParadaRota } from "@/lib/rotas/otimizar-rota";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  paradas: ParadaRota[];
  onFechar: () => void;
  onParadaAvancar?: (pontoId: string, pulada: boolean) => void | Promise<void>;
};

export function NavegacaoRotaView({ paradas, onFechar, onParadaAvancar }: Props) {
  const paradasComCoords = useMemo(
    () => paradas.filter((p) => p.temCoordenadas && p.latitude != null && p.longitude != null),
    [paradas]
  );

  const [indiceDestino, setIndiceDestino] = useState(0);
  const [rotaAtual, setRotaAtual] = useState<OsrmRota | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const [seguirUsuario, setSeguirUsuario] = useState(true);

  const { posicao, erro: erroGps, carregando: gpsCarregando } = useGeolocalizacaoAoVivo(true);

  const destino = paradasComCoords[indiceDestino] ?? null;
  const rotaConcluida = indiceDestino >= paradasComCoords.length;

  const distanciaLinhaReta = useMemo(() => {
    if (!posicao || !destino?.latitude || !destino.longitude) return null;
    return haversineKm(posicao, {
      latitude: destino.latitude,
      longitude: destino.longitude,
    });
  }, [posicao, destino]);

  const chegou = distanciaLinhaReta != null && distanciaLinhaReta < 0.08;

  const atualizarRota = useCallback(async () => {
    if (!destino?.latitude || !destino.longitude) return;
    const origem: Coordenada = posicao ?? {
      latitude: destino.latitude,
      longitude: destino.longitude,
    };
    setCarregandoRota(true);
    try {
      const rota = await buscarRotaOsrm([
        origem,
        { latitude: destino.latitude, longitude: destino.longitude },
      ]);
      setRotaAtual(rota);
    } finally {
      setCarregandoRota(false);
    }
  }, [destino, posicao]);

  useEffect(() => {
    if (rotaConcluida) return;
    void atualizarRota();
  }, [indiceDestino, rotaConcluida, atualizarRota]);

  // Recalcula rota a cada ~200m de movimento
  useEffect(() => {
    if (!posicao || rotaConcluida) return;
    const t = setInterval(() => void atualizarRota(), 45000);
    return () => clearInterval(t);
  }, [posicao, rotaConcluida, atualizarRota]);

  async function avancarParada(pulada = false) {
    const atual = paradasComCoords[indiceDestino];
    if (atual && onParadaAvancar) {
      await onParadaAvancar(atual.id, pulada);
    }
    setIndiceDestino((i) => i + 1);
    setRotaAtual(null);
  }

  const instrucao =
    rotaAtual?.passos[0]?.instrucao ??
    (destino ? `Siga até ${destino.nome}` : "Rota concluída");

  const distanciaExibir = rotaAtual
    ? formatarDistancia(rotaAtual.distanciaMetros)
    : distanciaLinhaReta != null
      ? formatarDistancia(distanciaLinhaReta * 1000)
      : "—";

  const tempoExibir = rotaAtual ? formatarDuracao(rotaAtual.duracaoSegundos) : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950">
      {/* Mapa expansivo */}
      <div className="relative min-h-0 flex-1 w-full">
        <RotaMapaAvancado
          paradas={paradas}
          inicio={posicao}
          posicaoAoVivo={posicao}
          rotaRuas={rotaAtual?.coordinates ?? null}
          seguirUsuario={seguirUsuario}
          indiceDestino={indiceDestino}
          mapKey="navegacao"
          className="absolute inset-0 h-full w-full"
        />

        {/* Barra superior — instrução */}
        {!rotaConcluida && (
          <div className="absolute left-0 right-0 top-0 z-[1000] bg-gradient-to-b from-black/85 via-black/60 to-transparent p-4 pb-8">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onFechar}
                className="shrink-0 rounded-full bg-black/50 p-2 text-white backdrop-blur"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 rounded-xl bg-slate-900/90 backdrop-blur border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-primary-neon">
                  <Navigation className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Parada {destino?.ordem ?? "—"} de {paradasComCoords.length}
                  </span>
                </div>
                <p className="mt-1 text-base font-semibold text-white leading-snug">
                  {carregandoRota ? "Calculando rota…" : instrucao}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="font-bold text-white">{distanciaExibir}</span>
                  {tempoExibir && <span>· {tempoExibir}</span>}
                  {chegou && (
                    <span className="text-green-400 font-medium">· Você está perto!</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botões flutuantes */}
        <div className="absolute right-4 top-28 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setSeguirUsuario((s) => !s)}
            className={cn(
              "rounded-full p-3 shadow-lg backdrop-blur",
              seguirUsuario
                ? "bg-primary-neon text-slate-900"
                : "bg-slate-900/90 text-white border border-white/20"
            )}
            title="Seguir minha posição"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {(erroGps || gpsCarregando) && (
          <div className="absolute left-4 right-4 top-28 z-[999] rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-slate-900">
            {erroGps ?? "Obtendo GPS…"}
          </div>
        )}
      </div>

      {/* Painel inferior */}
      <div
        className={cn(
          "relative z-[1001] shrink-0 border-t border-white/10 bg-slate-900/95 backdrop-blur transition-all",
          painelAberto ? "max-h-[45vh]" : "max-h-14"
        )}
      >
        <button
          type="button"
          onClick={() => setPainelAberto((p) => !p)}
          className="flex w-full items-center justify-center py-2 text-slate-500"
        >
          <ChevronUp
            className={cn("h-5 w-5 transition", painelAberto && "rotate-180")}
          />
        </button>

        {painelAberto && (
          <div className="overflow-y-auto px-4 pb-6 pt-0 max-h-[40vh] space-y-4">
            {rotaConcluida ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
                <p className="text-lg font-semibold text-white">Rota concluída!</p>
                <button
                  type="button"
                  onClick={onFechar}
                  className="rounded-lg bg-primary-neon px-6 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Voltar
                </button>
              </div>
            ) : destino ? (
              <>
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-lg font-bold text-amber-400">
                    {destino.ordem}
                  </span>
                  {destino.fotoUrl ? (
                    <img
                      src={destino.fotoUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-800">
                      <MapPin className="h-6 w-6 text-slate-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{destino.nome}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[destino.endereco, destino.cidade].filter(Boolean).join(" · ")}
                    </p>
                    {(destino.pendente ?? 0) > 0.009 && (
                      <p className="text-xs text-amber-400 mt-1">
                        Deve {formatCurrency(destino.pendente!)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/coletas/nova?ponto=${destino.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-neon py-3 text-sm font-semibold text-slate-900"
                  >
                    <Package className="h-4 w-4" />
                    Coletar
                  </Link>
                  <button
                    type="button"
                    onClick={() => void avancarParada(!chegou)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
                      chegou
                        ? "bg-green-500 text-white"
                        : "border border-slate-600 text-slate-300"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {chegou ? "Cheguei — próximo" : "Pular parada"}
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">
                    Próximas paradas
                  </p>
                  {paradasComCoords.slice(indiceDestino + 1, indiceDestino + 4).map((p) => (
                    <p key={p.id} className="text-sm text-slate-400 truncate">
                      {p.ordem}. {p.nome}
                    </p>
                  ))}
                  {paradasComCoords.length - indiceDestino - 1 <= 0 && (
                    <p className="text-sm text-slate-600">Última parada</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {carregandoRota && (
        <div className="absolute bottom-24 left-1/2 z-[1002] -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
          Atualizando rota
        </div>
      )}
    </div>
  );
}
