import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

type ItemBody = { produto_id?: unknown; quantidade?: unknown };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const itensBody: ItemBody[] = Array.isArray(body.itens) ? body.itens : [];

  const supabase = await createClient();

  const { data: equipamento } = await supabase
    .from("equipamentos")
    .select("id, tipo")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!equipamento) {
    return NextResponse.json({ error: "Expositor não encontrado." }, { status: 404 });
  }
  if (equipamento.tipo !== "consignado") {
    return NextResponse.json({ error: "Este equipamento não é um expositor consignado." }, { status: 400 });
  }

  const produtoIds = itensBody
    .map((i) => String(i.produto_id ?? "").trim())
    .filter(Boolean);

  const { data: produtos } = produtoIds.length
    ? await supabase
        .from("produtos_consignados")
        .select("id, nome, custo_unitario")
        .eq("empresa_id", profile.empresa_id)
        .in("id", produtoIds)
    : { data: [] };
  const produtosMap = new Map((produtos ?? []).map((p) => [p.id, p]));

  const estoque = itensBody
    .map((i) => {
      const produtoId = String(i.produto_id ?? "").trim();
      const produto = produtosMap.get(produtoId);
      const quantidade = Math.max(0, Math.floor(Number(i.quantidade) || 0));
      if (!produto || quantidade <= 0) return null;
      return {
        item_id: produtoId,
        nome: produto.nome,
        quantidade,
        custo_unitario: Number(produto.custo_unitario ?? 0),
      };
    })
    .filter((x): x is { item_id: string; nome: string; quantidade: number; custo_unitario: number } => Boolean(x));

  const { error } = await supabase
    .from("equipamentos")
    .update({ estoque_brindes: estoque })
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, itens: estoque.length, estoque_brindes: estoque });
}
