"use client";

import { useEffect, useRef } from "react";
import type { ParadaRota, Coordenada } from "@/lib/rotas/otimizar-rota";
import "leaflet/dist/leaflet.css";

type Props = {
  paradas: ParadaRota[];
  inicio: Coordenada | null;
  paradaSelecionada?: string | null;
  onSelecionarParada?: (pontoId: string) => void;
  className?: string;
};

export function RotaMapa({
  paradas,
  inicio,
  paradaSelecionada,
  onSelecionarParada,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || paradas.length === 0) return;

    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;

      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const comCoords = paradas.filter((p) => p.temCoordenadas);
      if (comCoords.length === 0) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = [];

      if (inicio) {
        latLngs.push([inicio.latitude, inicio.longitude]);
        const startIcon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0f172a">EU</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([inicio.latitude, inicio.longitude], { icon: startIcon })
          .addTo(map)
          .bindPopup("<strong>Sua posição</strong>");
      }

      for (const p of paradas) {
        if (!p.temCoordenadas || p.latitude == null || p.longitude == null) continue;

        const pos: [number, number] = [p.latitude, p.longitude];
        latLngs.push(pos);

        const selected = paradaSelecionada === p.id;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:32px;height:32px;border-radius:50%;background:${selected ? "#22d3ee" : "#f59e0b"};border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#0f172a">${p.ordem}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const foto = p.fotoUrl
          ? `<img src="${p.fotoUrl}" alt="" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px" />`
          : "";

        const popup = `
          <div style="min-width:160px;font-family:system-ui,sans-serif">
            ${foto}
            <strong style="font-size:14px">${p.ordem}. ${p.nome}</strong>
            ${p.endereco ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b">${p.endereco}</p>` : ""}
            ${p.pendente && p.pendente > 0 ? `<p style="margin:6px 0 0;font-size:12px;color:#f59e0b;font-weight:600">Deve R$ ${p.pendente.toFixed(2).replace(".", ",")}</p>` : ""}
          </div>
        `;

        const marker = L.marker(pos, { icon }).addTo(map).bindPopup(popup);
        marker.on("click", () => onSelecionarParada?.(p.id));
      }

      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: "#22d3ee",
          weight: 3,
          opacity: 0.75,
          dashArray: "8 6",
        }).addTo(map);
      }

      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [paradas, inicio, paradaSelecionada, onSelecionarParada]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-[420px] w-full rounded-xl overflow-hidden border border-white/[0.08] z-0"}
    />
  );
}
