import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { carregarKitCompleto } from "@/lib/nichos/fura-fura/kits/instalar-kit-ponto";
import {
  calcularKitsPossiveis,
  montarKitsNoCentral,
} from "@/lib/nichos/fura-fura/kits/montar-kit-estoque";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: kitId } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const montarMaximo = Boolean(body.montar_maximo);
  let quantidade = Math.floor(Number(body.quantidade) || 0);

  const supabase = await createClient();

  if (montarMaximo) {
    const loaded = await carregarKitCompleto(supabase, kitId, profile.empresa_id);
    if ("error" in loaded && loaded.error) {
      return NextResponse.json({ error: loaded.error }, { status: 400 });
    }
    const { data: estoque } = await supabase
      .from("estoque")
      .select("id, quantidade")
      .eq("empresa_id", profile.empresa_id);
    quantidade = calcularKitsPossiveis(loaded.reposicao, estoque ?? []);
    if (quantidade < 1) {
      return NextResponse.json(
        { error: "Estoque avulso insuficiente para montar pelo menos 1 kit." },
        { status: 400 }
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await montarKitsNoCentral(supabase, {
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
    montados: result.montados,
    total_no_deposito: result.totalNoDeposito,
  });
}
