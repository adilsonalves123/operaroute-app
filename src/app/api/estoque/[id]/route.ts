import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (body.nome_item != null) updates.nome_item = String(body.nome_item).trim();
  if (body.categoria != null) updates.categoria = String(body.categoria).trim();
  if (body.custo_unitario != null) updates.custo_unitario = Math.max(0, Number(body.custo_unitario) || 0);
  if (body.quantidade != null) updates.quantidade = Math.max(0, Math.floor(Number(body.quantidade) || 0));
  if (body.quantidade_minima != null) {
    updates.quantidade_minima = Math.max(0, Math.floor(Number(body.quantidade_minima) || 0));
  }
  if (body.fornecedor !== undefined) {
    updates.fornecedor = body.fornecedor ? String(body.fornecedor).trim() : null;
  }
  if (body.observacao !== undefined) {
    updates.observacao = body.observacao ? String(body.observacao).trim() : null;
  }

  const { error } = await supabase
    .from("estoque")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("estoque")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
