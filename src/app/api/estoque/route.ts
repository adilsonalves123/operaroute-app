import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("nome_item");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const nome = String(body.nome_item ?? "").trim();
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do item." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque")
    .insert({
      empresa_id: profile.empresa_id,
      nome_item: nome,
      categoria: String(body.categoria ?? "brinde").trim() || "brinde",
      custo_unitario: Math.max(0, Number(body.custo_unitario) || 0),
      quantidade: Math.max(0, Math.floor(Number(body.quantidade) || 0)),
      quantidade_minima: Math.max(0, Math.floor(Number(body.quantidade_minima) || 0)),
      fornecedor: body.fornecedor ? String(body.fornecedor).trim() : null,
      observacao: body.observacao ? String(body.observacao).trim() : null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Number(body.quantidade) > 0) {
    await supabase.from("estoque_movimentacoes").insert({
      empresa_id: profile.empresa_id,
      item_id: data!.id,
      tipo: "entrada",
      quantidade: Math.floor(Number(body.quantidade)),
      observacao: "Cadastro inicial",
    });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
