import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { buscarHistoricoPorNumeroSerie } from "@/lib/equipamentos/buscar-historico-serie";
import { numeroSerieValido } from "@/lib/equipamentos/numero-serie";

export async function GET(request: Request) {
  const auth = await requireAcesso("pontos", "ver");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const serie = searchParams.get("serie")?.trim() ?? "";
  const pontoId = searchParams.get("ponto_id")?.trim() || undefined;

  if (!numeroSerieValido(serie)) {
    return NextResponse.json(
      { error: "Informe pelo menos 2 caracteres do número de série." },
      { status: 400 }
    );
  }

  const resultado = await buscarHistoricoPorNumeroSerie(
    auth.supabase,
    auth.profile.empresa_id!,
    serie,
    { pontoAtualId: pontoId }
  );

  return NextResponse.json(resultado);
}
