import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { desmontarKitsNoCentral } from "@/lib/nichos/fura-fura/kits/montar-kit-estoque";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: kitId } = await ctx.params;
  const auth = await requireAcesso("estoque", "editar");
  if (!auth.ok) return auth.response;
  const { profile, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const quantidade = Math.floor(Number(body.quantidade) || 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await desmontarKitsNoCentral(supabase, {
    empresaId: profile.empresa_id,
    kitId,
    quantidade,
    operadorId: user?.id ?? null,
  });

  if (result.error) {
    const needsMigration =
      result.error.includes("fura_kits_estoque") || result.error.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/fura-fura-kits-montados.sql no Supabase SQL Editor."
          : result.error,
      },
      { status: needsMigration ? 500 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    desmontados: result.desmontados,
    total_no_deposito: result.totalNoDeposito,
  });
}
