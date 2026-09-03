"use client";

import { useEffect, useRef, useState } from "react";
import type { ParadaRota, Coordenada } from "@/lib/rotas/otimizar-rota";
import type { PosicaoAoVivo } from "@/lib/rotas/use-geolocalizacao";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

const TILE_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_CARTO =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

type Props = {
  paradas: ParadaRota[];
  inicio: Coordenada | null;
  paradaSelecionada?: string | null;
  onSelecionarParada?: (pontoId: string) => void;
  className?: string;
  rotaRuas?: [number, number][] | null;
  posicaoAoVivo?: PosicaoAoVivo | null;
  seguirUsuario?: boolean;
  indiceDestino?: number;
  mapKey?: string;
};

function limparLeafletId(el: HTMLDivElement | null) {
  if (!el) return;
  const node = el as HTMLDivElement & { _leaflet_id?: number };
  delete node._leaflet_id;
}

export function RotaMapaAvancado({
  paradas,
  inicio,
  paradaSelecionada,
  onSelecionarParada,
  className,
  rotaRuas,
  posicaoAoVivo,
  seguirUsuario = false,
  indiceDestino,
  mapKey = "map",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const userLayersRef = useRef<{
    dot: import("leaflet").CircleMarker | null;
    ring: import("leaflet").Circle | null;
  }>({ dot: null, ring: null });
  const onSelectRef = useRef(onSelecionarParada);
  onSelectRef.current = onSelecionarParada;

  const [mapReady, setMapReady] = useState(false);

  // Cria o mapa uma vez por mapKey (evita cinza por rebuild constante)
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      limparLeafletId(containerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layersRef.current = null;
      userLayersRef.current = { dot: null, ring: null };
      setMapReady(false);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled || !containerRef.current) return;

      const el = containerRef.current;
      const map = L.map(el, { zoomControl: true, scrollWheelZoom: true });
      mapRef.current = map;

      const osm = L.tileLayer(TILE_OSM, { attribution: TILE_ATTRIBUTION, maxZoom: 19 });
      const carto = L.tileLayer(TILE_CARTO, { attribution: TILE_ATTRIBUTION, maxZoom: 20 });
      osm.addTo(map);

      let usouFallback = false;
      osm.on("tileerror", () => {
        if (usouFallback) return;
        usouFallback = true;
        map.removeLayer(osm);
        carto.addTo(map);
      });

      layersRef.current = L.layerGroup().addTo(map);

      const fixSize = () => {
        if (!mapRef.current || cancelled) return;
        mapRef.current.invalidateSize({ animate: false });
      };

      map.whenReady(fixSize);
      fixSize();
      setTimeout(fixSize, 150);
      setTimeout(fixSize, 500);

      resizeObserver = new ResizeObserver(fixSize);
      resizeObserver.observe(el);

      if (!cancelled) setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      setMapReady(false);
      resizeObserver?.disconnect();
      layersRef.current = null;
      userLayersRef.current = { dot: null, ring: null };
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      limparLeafletId(containerRef.current);
    };
  }, [mapKey]);

  // Marcadores, rota e enquadramento
  useEffect(() => {
    if (!mapReady || !mapRef.current || !layersRef.current) return;

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || !layersRef.current) return;

      const map = mapRef.current;
      const group = layersRef.current;
      group.clearLayers();

      const latLngs: [number, number][] = [];
      const posInicio = posicaoAoVivo ?? inicio;

      if (posInicio && !seguirUsuario) {
        latLngs.push([posInicio.latitude, posInicio.longitude]);
        L.circleMarker([posInicio.latitude, posInicio.longitude], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#22d3ee",
          fillOpacity: 1,
        })
          .addTo(group)
          .bindPopup("<strong>Você</strong>");
      }

      const paradasComCoords = paradas.filter((p) => p.temCoordenadas);
      for (const p of paradasComCoords) {
        if (p.latitude == null || p.longitude == null) continue;
        const pos: [number, number] = [p.latitude, p.longitude];
        latLngs.push(pos);

        const isDestino =
          indiceDestino != null && paradasComCoords[indiceDestino]?.id === p.id;
        const selected = paradaSelecionada === p.id || isDestino;

        const icon = L.divIcon({
          className: "",
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${selected ? "#22d3ee" : "#f59e0b"};border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#0f172a">${p.ordem}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const foto = p.fotoUrl
          ? `<img src="${p.fotoUrl}" alt="" style="width:100%;height:72px;object-fit:cover;border-radius:6px;margin-bottom:6px" />`
          : "";

        L.marker(pos, { icon, zIndexOffset: selected ? 1000 : 0 })
          .addTo(group)
          .bindPopup(
            `<div style="min-width:140px;font-family:system-ui,sans-serif">${foto}<strong>${p.ordem}. ${p.nome}</strong></div>`
          )
          .on("click", () => onSelectRef.current?.(p.id));
      }

      if (rotaRuas && rotaRuas.length >= 2) {
        L.polyline(rotaRuas, {
          color: "#22d3ee",
          weight: 6,
          opacity: 0.9,
          lineJoin: "round",
        }).addTo(group);
      } else if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: "#64748b",
          weight: 2,
          opacity: 0.45,
          dashArray: "6 8",
        }).addTo(group);
      }

      const fitTarget =
        rotaRuas && rotaRuas.length >= 2 ? rotaRuas : latLngs.length > 0 ? latLngs : null;

      const applyView = () => {
        if (!mapRef.current || cancelled) return;
        mapRef.current.invalidateSize({ animate: false });
        if (fitTarget) {
          if (fitTarget.length === 1) {
            mapRef.current.setView(fitTarget[0], 15);
          } else {
            mapRef.current.fitBounds(L.latLngBounds(fitTarget), {
              padding: [56, 56],
              maxZoom: 16,
            });
          }
        } else {
          mapRef.current.setView([-22.9, -47.0], 12);
        }
      };

      applyView();
      setTimeout(applyView, 200);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    paradas,
    inicio,
    paradaSelecionada,
    indiceDestino,
    rotaRuas,
    seguirUsuario,
    posicaoAoVivo,
  ]);

  // GPS ao vivo (sem rebuild)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !posicaoAoVivo || !seguirUsuario) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;
      const { latitude, longitude, accuracy } = posicaoAoVivo;
      const latlng: [number, number] = [latitude, longitude];

      if (userLayersRef.current.ring) {
        userLayersRef.current.ring.setLatLng(latlng);
        userLayersRef.current.ring.setRadius(accuracy);
      } else {
        userLayersRef.current.ring = L.circle(latlng, {
          radius: accuracy,
          color: "#22d3ee",
          fillColor: "#22d3ee",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);
      }

      if (userLayersRef.current.dot) {
        userLayersRef.current.dot.setLatLng(latlng);
      } else {
        userLayersRef.current.dot = L.circleMarker(latlng, {
          radius: 10,
          color: "#fff",
          weight: 3,
          fillColor: "#22d3ee",
          fillOpacity: 1,
        }).addTo(map);
      }

      map.setView(latlng, Math.max(map.getZoom(), 16), { animate: true });
    })();
  }, [mapReady, posicaoAoVivo, seguirUsuario]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "rota-mapa-root z-0",
        className ?? "h-[420px] w-full rounded-xl overflow-hidden border border-at-soft"
      )}
      style={{ minHeight: 280 }}
    />
  );
}
