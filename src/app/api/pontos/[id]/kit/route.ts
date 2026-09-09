import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { instalarKitNoPonto } from "@/lib/nichos/fura-fura/kits";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: pontoId } = await ctx.params;
  const auth = await requireAcesso("pontos", "editar");
  if (!auth.ok) return auth.response;
  const { profile, supabase } = auth;

  const body = await request.json();
  const kitId = String(body.kit_id ?? "").trim();
  if (!kitId) {
    return NextResponse.json({ error: "Selecione um kit." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await instalarKitNoPonto(supabase, {
    empresaId: profile.empresa_id,
    pontoId,
    kitId,
    operadorId: user?.id ?? null,
    observacao: body.observacao ? String(body.observacao).trim() : undefined,
  });

  if (result.error) {
    const needsMigration =
      result.error.includes("fura_kits") ||
      result.error.includes("fura_kits_estoque") ||
      result.error.includes("kit_ativo_id") ||
      result.error.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/fura-fura-kits.sql no Supabase SQL Editor."
          : result.error,
      },
      { status: needsMigration ? 500 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    kit_nome: result.kitNome,
    sobras_devolvidas: result.sobrasDevolvidas ?? 0,
    estoque_brindes: result.estoqueBrindes ?? [],
  });
}
