import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { devolverBrindeDoPontoParaCentral } from "@/lib/estoque/transferir-ponto";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: pontoId } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const itemId = typeof body.item_id === "string" ? body.item_id.trim() : undefined;
  const nome = typeof body.nome === "string" ? body.nome.trim() : undefined;

  if (!itemId && !nome) {
    return NextResponse.json({ error: "Informe o item a remover." }, { status: 400 });
  }

  const quantidade =
    body.quantidade != null ? Math.max(0, Math.floor(Number(body.quantidade) || 0)) : undefined;

  const supabase = await createClient();
  const result = await devolverBrindeDoPontoParaCentral(supabase, {
    empresaId: profile.empresa_id,
    pontoId,
    itemId,
    nome,
    quantidade: quantidade && quantidade > 0 ? quantidade : undefined,
    observacao: body.observacao ? String(body.observacao).trim() : undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    devolvido: result.devolvido,
  });
}
