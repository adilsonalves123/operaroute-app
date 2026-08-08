"use client";

import { useEffect, useState } from "react";
import type { Coordenada } from "./otimizar-rota";

export type PosicaoAoVivo = Coordenada & {
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export function useGeolocalizacaoAoVivo(ativo: boolean) {
  const [posicao, setPosicao] = useState<PosicaoAoVivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!ativo || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    setCarregando(true);
    setErro(null);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCarregando(false);
        setPosicao({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        setCarregando(false);
        setErro(
          err.code === 1
            ? "Permita o acesso à localização para navegar."
            : "Não foi possível obter o GPS."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ativo]);

  return { posicao, erro, carregando };
}
