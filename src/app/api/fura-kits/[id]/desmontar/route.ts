import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { desmontarKitsNoCentral } from "@/lib/nichos/fura-fura/kits/montar-kit-estoque";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: kitId } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const quantidade = Math.floor(Number(body.quantidade) || 0);

  const supabase = await createClient();
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
