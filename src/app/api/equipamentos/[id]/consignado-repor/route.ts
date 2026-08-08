import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";

type ItemBody = { produto_id?: unknown; quantidade?: unknown };

/** Soma quantidade ao estoque do expositor e baixa do catálogo central. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const itensBody: ItemBody[] = Array.isArray(body.itens) ? body.itens : [];

  const reporMap = new Map<string, number>();
  for (const item of itensBody) {
    const produtoId = String(item.produto_id ?? "").trim();
    const qty = Math.max(0, Math.floor(Number(item.quantidade) || 0));
    if (!produtoId || qty <= 0) continue;
    reporMap.set(produtoId, (reporMap.get(produtoId) ?? 0) + qty);
  }

  if (reporMap.size === 0) {
    return NextResponse.json({ error: "Informe ao menos um produto para repor." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: equipamento } = await supabase
    .from("equipamentos")
    .select("id, tipo, estoque_brindes")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!equipamento) {
    return NextResponse.json({ error: "Expositor não encontrado." }, { status: 404 });
  }
  if (equipamento.tipo !== "consignado") {
    return NextResponse.json(
      { error: "Este equipamento não é um expositor consignado." },
      { status: 400 }
    );
  }

  const produtoIds = [...reporMap.keys()];
  const { data: produtos } = await supabase
    .from("produtos_consignados")
    .select("id, nome, custo_unitario, quantidade")
    .eq("empresa_id", profile.empresa_id)
    .in("id", produtoIds);

  const produtosMap = new Map((produtos ?? []).map((p) => [p.id, p]));

  for (const [produtoId, qty] of reporMap) {
    const produto = produtosMap.get(produtoId);
    if (!produto) {
      return NextResponse.json({ error: "Produto inválido na reposição." }, { status: 400 });
    }
    const disponivel = Math.max(0, Math.floor(Number(produto.quantidade) || 0));
    if (qty > disponivel) {
      return NextResponse.json(
        {
          error: `${produto.nome}: só há ${disponivel} un. no estoque central (tentou repor ${qty}).`,
        },
        { status: 400 }
      );
    }
  }

  const estoqueAtual = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
  const porId = new Map(estoqueAtual.map((e) => [e.item_id ?? "", e]));

  for (const [produtoId, qty] of reporMap) {
    const produto = produtosMap.get(produtoId)!;
    const prev = porId.get(produtoId);
    if (prev) {
      porId.set(produtoId, {
        ...prev,
        quantidade: Math.max(0, Math.floor(Number(prev.quantidade) || 0)) + qty,
      });
    } else {
      porId.set(produtoId, {
        item_id: produtoId,
        nome: produto.nome,
        quantidade: qty,
        custo_unitario: Number(produto.custo_unitario ?? 0),
      });
    }
  }

  const novoEstoque = [...porId.values()].filter((e) => (Number(e.quantidade) || 0) > 0);

  const { error: updateEqError } = await supabase
    .from("equipamentos")
    .update({ estoque_brindes: novoEstoque })
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (updateEqError) {
    return NextResponse.json({ error: updateEqError.message }, { status: 500 });
  }

  for (const [produtoId, qty] of reporMap) {
    const produto = produtosMap.get(produtoId)!;
    const atual = Math.max(0, Math.floor(Number(produto.quantidade) || 0));
    await supabase
      .from("produtos_consignados")
      .update({ quantidade: Math.max(0, atual - qty) })
      .eq("id", produtoId)
      .eq("empresa_id", profile.empresa_id);
  }

  return NextResponse.json({
    success: true,
    itens_repostos: reporMap.size,
    estoque_brindes: novoEstoque,
  });
}
