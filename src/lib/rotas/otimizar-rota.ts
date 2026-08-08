export type Coordenada = {
  latitude: number;
  longitude: number;
};

export type PontoRotaInput = {
  id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  fotoUrl?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  /** Menor = mais urgente (prioridade operacional) */
  scorePrioridade: number;
  pendente?: number;
};

export type ParadaRota = PontoRotaInput & {
  ordem: number;
  temCoordenadas: boolean;
  distanciaAnteriorKm: number | null;
  /** ID em rota_pontos quando carregada de rota salva */
  rotaParadaId?: string;
  statusParada?: string;
};

export type ResultadoRotaOtimizada = {
  paradas: ParadaRota[];
  distanciaTotalKm: number;
  comCoordenadas: number;
  semCoordenadas: number;
};

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: Coordenada, b: Coordenada): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function distanciaEntre(a: PontoRotaInput, b: PontoRotaInput): number {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return Infinity;
  }
  return haversineKm(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  );
}

function distanciaTotal(caminho: PontoRotaInput[], inicio: Coordenada | null): number {
  if (caminho.length === 0) return 0;
  let total = 0;
  let prev: Coordenada | PontoRotaInput | null = inicio;

  for (let i = 0; i < caminho.length; i++) {
    const p = caminho[i];
    if (p.latitude == null || p.longitude == null) continue;
    if (prev) {
      const d =
        "scorePrioridade" in (prev as PontoRotaInput)
          ? distanciaEntre(prev as PontoRotaInput, p)
          : haversineKm(prev as Coordenada, {
              latitude: p.latitude,
              longitude: p.longitude,
            });
      total += d;
    }
    prev = p;
  }
  return Math.round(total * 100) / 100;
}

/** Nearest neighbor + 2-opt para reduzir distância. */
function otimizarCaminhoGeografico(
  pontos: PontoRotaInput[],
  inicio: Coordenada | null
): PontoRotaInput[] {
  if (pontos.length <= 1) return [...pontos];

  const restantes = [...pontos];
  const caminho: PontoRotaInput[] = [];

  let atual: Coordenada | PontoRotaInput | null = inicio;

  if (!atual) {
    restantes.sort((a, b) => a.scorePrioridade - b.scorePrioridade);
    caminho.push(restantes.shift()!);
    atual = caminho[0];
  }

  while (restantes.length > 0) {
    let melhorIdx = 0;
    let melhorDist = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = atual
        ? distanciaEntre(atual as PontoRotaInput, restantes[i])
        : restantes[i].scorePrioridade;
      const bonusUrgente = restantes[i].scorePrioridade <= 1 ? -0.3 : 0;
      const score = (typeof d === "number" ? d : 0) + bonusUrgente;
      if (score < melhorDist) {
        melhorDist = score;
        melhorIdx = i;
      }
    }
    const next = restantes.splice(melhorIdx, 1)[0];
    caminho.push(next);
    atual = next;
  }

  // 2-opt
  let melhorou = true;
  while (melhorou) {
    melhorou = false;
    for (let i = 0; i < caminho.length - 1; i++) {
      for (let j = i + 2; j < caminho.length; j++) {
        const antes = distanciaTotal(caminho, inicio);
        const invertido = [
          ...caminho.slice(0, i + 1),
          ...caminho.slice(i + 1, j + 1).reverse(),
          ...caminho.slice(j + 1),
        ];
        const depois = distanciaTotal(invertido, inicio);
        if (depois + 0.01 < antes) {
          caminho.splice(0, caminho.length, ...invertido);
          melhorou = true;
        }
      }
    }
  }

  return caminho;
}

export function otimizarRota(
  pontos: PontoRotaInput[],
  inicio: Coordenada | null = null
): ResultadoRotaOtimizada {
  const comCoords = pontos.filter((p) => p.latitude != null && p.longitude != null);
  const semCoords = pontos.filter((p) => p.latitude == null || p.longitude == null);

  const geoOrdenados = otimizarCaminhoGeografico(comCoords, inicio);
  const semOrdenados = [...semCoords].sort((a, b) => a.scorePrioridade - b.scorePrioridade);
  const sequencia = [...geoOrdenados, ...semOrdenados];

  let distAcum = 0;
  let prev: Coordenada | PontoRotaInput | null = inicio;

  const paradas: ParadaRota[] = sequencia.map((p, idx) => {
    let distAnterior: number | null = null;
    if (p.latitude != null && p.longitude != null) {
      if (prev) {
        const d =
          "latitude" in prev && "longitude" in prev && !("id" in prev)
            ? haversineKm(prev as Coordenada, {
                latitude: p.latitude,
                longitude: p.longitude,
              })
            : distanciaEntre(prev as PontoRotaInput, p);
        distAnterior = Math.round(d * 100) / 100;
        distAcum += d;
      }
      prev = p;
    }
    return {
      ...p,
      ordem: idx + 1,
      temCoordenadas: p.latitude != null && p.longitude != null,
      distanciaAnteriorKm: distAnterior,
    };
  });

  return {
    paradas,
    distanciaTotalKm: Math.round(distAcum * 100) / 100,
    comCoordenadas: comCoords.length,
    semCoordenadas: semCoords.length,
  };
}

function paradaConcluida(p: ParadaRota): boolean {
  return p.statusParada === "concluida" || p.statusParada === "pulada";
}

/** Recalcula ordem e distâncias após reordenação manual. */
export function recalcularOrdemParadas(
  paradas: ParadaRota[],
  inicio: Coordenada | null
): ResultadoRotaOtimizada {
  let distAcum = 0;
  let prev: Coordenada | PontoRotaInput | null = inicio;

  const reordenadas: ParadaRota[] = paradas.map((p, idx) => {
    let distAnterior: number | null = null;
    if (p.latitude != null && p.longitude != null) {
      if (prev) {
        const d =
          "latitude" in prev && "longitude" in prev && !("id" in prev)
            ? haversineKm(prev as Coordenada, {
                latitude: p.latitude,
                longitude: p.longitude,
              })
            : distanciaEntre(prev as PontoRotaInput, p);
        distAnterior = Math.round(d * 100) / 100;
        distAcum += d;
      }
      prev = p;
    }
    return {
      ...p,
      ordem: idx + 1,
      temCoordenadas: p.latitude != null && p.longitude != null,
      distanciaAnteriorKm: distAnterior,
    };
  });

  const comCoords = reordenadas.filter((p) => p.temCoordenadas).length;
  return {
    paradas: reordenadas,
    distanciaTotalKm: Math.round(distAcum * 100) / 100,
    comCoordenadas: comCoords,
    semCoordenadas: reordenadas.length - comCoords,
  };
}

/** Otimiza só paradas pendentes; mantém concluídas/puladas no início. */
export function otimizarParadasRestantes(
  paradas: ParadaRota[],
  inicio: Coordenada | null
): ResultadoRotaOtimizada {
  const fixas = paradas.filter(paradaConcluida);
  const pendentes = paradas.filter((p) => !paradaConcluida(p));

  if (pendentes.length === 0) {
    return recalcularOrdemParadas(paradas, inicio);
  }

  const ultimaFixaComGps = [...fixas].reverse().find((p) => p.temCoordenadas);
  const inicioOtimizacao: Coordenada | null = ultimaFixaComGps
    ? { latitude: ultimaFixaComGps.latitude!, longitude: ultimaFixaComGps.longitude! }
    : inicio;

  const opt = otimizarRota(pendentes, inicioOtimizacao);
  const mescladas = [...fixas, ...opt.paradas.map((p) => ({ ...p, statusParada: p.statusParada ?? "pendente" }))];
  return recalcularOrdemParadas(mescladas, inicio);
}

export function moverParadaNaLista(
  paradas: ParadaRota[],
  index: number,
  direcao: "up" | "down",
  inicio: Coordenada | null
): ResultadoRotaOtimizada | null {
  const alvo = direcao === "up" ? index - 1 : index + 1;
  if (alvo < 0 || alvo >= paradas.length) return null;
  if (paradaConcluida(paradas[index]) || paradaConcluida(paradas[alvo])) return null;

  const copia = [...paradas];
  [copia[index], copia[alvo]] = [copia[alvo], copia[index]];
  return recalcularOrdemParadas(copia, inicio);
}

export function linkGoogleMapsRota(
  paradas: ParadaRota[],
  inicio: Coordenada | null
): string | null {
  const coords = paradas.filter((p) => p.temCoordenadas);
  if (coords.length === 0) return null;

  const fmt = (p: { latitude: number | null; longitude: number | null }) =>
    `${p.latitude},${p.longitude}`;

  const origin = inicio ? `${inicio.latitude},${inicio.longitude}` : fmt(coords[0]);
  const destination = fmt(coords[coords.length - 1]);
  const waypoints =
    coords.length > 2
      ? coords
          .slice(inicio ? 0 : 1, -1)
          .map(fmt)
          .join("|")
      : coords.length === 2 && inicio
        ? fmt(coords[0])
        : "";

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
