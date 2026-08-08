import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadUniversidadeAulasPublic } from "@/lib/dono/universidade-aulas";
import { UNIVERSIDADE_AULAS } from "@/lib/universidade/aulas";

/** Catálogo público da Universidade (app do cliente). */
export async function GET() {
  const padrao = {
    aulas: UNIVERSIDADE_AULAS,
    fonte: "padrao" as const,
  };

  if (!isAdminConfigured()) {
    return NextResponse.json(padrao);
  }

  try {
    const data = await loadUniversidadeAulasPublic(createAdminClient());
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(padrao);
  }
}
