import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const pontoId = searchParams.get("ponto_id")?.trim();
  if (!pontoId) {
    return NextResponse.json({ error: "Informe o ponto." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("visitas_ponto")
    .select("id, created_at")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", pontoId)
    .eq("status", "rascunho")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ rascunho: data });
}
