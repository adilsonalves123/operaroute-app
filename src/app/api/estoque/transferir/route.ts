import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { transferirEstoqueParaPonto } from "@/lib/estoque/transferir-ponto";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const itemId = String(body.item_id ?? "").trim();
  const pontoId = String(body.ponto_id ?? "").trim();
  const quantidade = Math.floor(Number(body.quantidade) || 0);

  if (!itemId || !pontoId) {
    return NextResponse.json({ error: "Informe item e ponto." }, { status: 400 });
  }
  if (quantidade <= 0) {
    return NextResponse.json({ error: "Informe uma quantidade válida." }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await transferirEstoqueParaPonto(supabase, {
    empresaId: profile.empresa_id,
    itemId,
    pontoId,
    quantidade,
    observacao: body.observacao ? String(body.observacao).trim() : undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
