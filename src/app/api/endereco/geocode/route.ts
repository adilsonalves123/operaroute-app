import { NextResponse } from "next/server";
import { reverseGeocode, forwardGeocode } from "@/lib/endereco/geocode";

export const runtime = "nodejs";

/** Reverse (lat/lng) ou forward (q) via Nominatim — proxy server-side. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng") ?? url.searchParams.get("lon");
  const q = url.searchParams.get("q");

  try {
    if (lat != null && lng != null) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
      }
      const data = await reverseGeocode(latitude, longitude);
      if (!data) {
        return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    if (q?.trim()) {
      const data = await forwardGeocode(q.trim());
      if (!data) {
        return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Informe lat+lng ou q (busca)." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Falha na geocodificação.",
      },
      { status: 502 }
    );
  }
}
