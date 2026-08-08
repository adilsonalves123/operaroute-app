import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  defaultNichoCovers,
  loadNichoCatalogPublic,
  nichosEditaveisCovers,
} from "@/lib/dono/nicho-covers";

/** Catálogo público do carrossel (covers, textos, ativos/pausados). */
export async function GET() {
  const padrao = {
    covers: defaultNichoCovers(),
    labels: {},
    descricoes: {},
    ativos: nichosEditaveisCovers(),
    pausados: [] as string[],
  };

  if (!isAdminConfigured()) {
    return NextResponse.json(padrao);
  }
  try {
    const catalog = await loadNichoCatalogPublic(createAdminClient());
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(padrao);
  }
}
