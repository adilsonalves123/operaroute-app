import type { Coordenada } from "./otimizar-rota";

export type OsrmPasso = {
  instrucao: string;
  distanciaMetros: number;
  duracaoSegundos: number;
};

export type OsrmRota = {
  /** [latitude, longitude] para Leaflet */
  coordinates: [number, number][];
  distanciaMetros: number;
  duracaoSegundos: number;
  passos: OsrmPasso[];
};

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

function traduzirManeuver(type: string, modifier?: string, name?: string): string {
  const rua = name && name !== "-" ? ` em ${name}` : "";
  const mod = modifier ?? "";
  if (type === "arrive") return "Você chegou ao destino";
  if (type === "depart") return `Siga${rua}`;
  if (type === "roundabout") return `Entre na rotatória${rua}`;
  if (type === "merge") return `Entre na via${rua}`;
  if (mod.includes("right")) return `Vire à direita${rua}`;
  if (mod.includes("left")) return `Vire à esquerda${rua}`;
  if (mod.includes("straight") || type === "continue") return `Continue reto${rua}`;
  if (mod.includes("uturn")) return `Faça retorno${rua}`;
  return `Siga${rua}`;
}

export async function buscarRotaOsrm(pontos: Coordenada[]): Promise<OsrmRota | null> {
  if (pontos.length < 2) return null;

  const coordStr = pontos.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url = `${OSRM_BASE}/${coordStr}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates) return null;

  const coordinates: [number, number][] = route.geometry.coordinates.map(
    (c: [number, number]) => [c[1], c[0]] as [number, number]
  );

  const passos: OsrmPasso[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      passos.push({
        instrucao: traduzirManeuver(
          step.maneuver?.type ?? "continue",
          step.maneuver?.modifier,
          step.name
        ),
        distanciaMetros: Number(step.distance ?? 0),
        duracaoSegundos: Number(step.duration ?? 0),
      });
    }
  }

  return {
    coordinates,
    distanciaMetros: Number(route.distance ?? 0),
    duracaoSegundos: Number(route.duration ?? 0),
    passos,
  };
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

export function formatarDuracao(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
