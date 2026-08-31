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

  let quantidadeAnterior: number | null = null;
  if (body.quantidade != null) {
    const { data: atual } = await supabase
      .from("estoque")
      .select("quantidade")
      .eq("id", id)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();
    quantidadeAnterior = Math.max(0, Math.floor(Number(atual?.quantidade ?? 0)));
  }

  const updates: Record<string, unknown> = {};
  if (body.nome_item != null) updates.nome_item = String(body.nome_item).trim();
  if (body.descricao !== undefined) {
    updates.descricao = body.descricao ? String(body.descricao).trim() : null;
  }
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
  if (body.foto_url !== undefined) {
    updates.foto_url = body.foto_url ? String(body.foto_url).trim() : null;
  }

  const { error } = await supabase
    .from("estoque")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("descricao") || msg.includes("schema cache")) {
      return NextResponse.json(
        {
          error:
            "Coluna descricao ausente. Rode supabase/estoque-descricao.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (quantidadeAnterior != null && "quantidade" in updates) {
    const nova = updates.quantidade as number;
    const delta = nova - quantidadeAnterior;
    if (delta !== 0) {
      const { error: movErr } = await supabase.from("estoque_movimentacoes").insert({
        empresa_id: profile.empresa_id,
        item_id: id,
        tipo: delta > 0 ? "entrada" : "saida",
        quantidade: Math.abs(delta),
        observacao: delta > 0 ? "Entrada rápida" : "Saída rápida",
      });
      if (movErr) {
        console.error("estoque_movimentacoes:", movErr.message);
      }
    }
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "estoque.editar",
    tabela: "estoque",
    registroId: id,
    dadosNovos: updates,
    severidade: "quantidade" in updates ? "medium" : "low",
    categoria: "estoque",
    modulo: "estoque",
    titulo: "Editou item de estoque",
    resumo: Object.keys(updates).join(", ") || "atualização",
    request,
  });

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

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "estoque.excluir",
    tabela: "estoque",
    registroId: id,
    severidade: "high",
    categoria: "estoque",
    modulo: "estoque",
    titulo: "Removeu item de estoque",
    resumo: `Item ${id}`,
  });

  return NextResponse.json({ success: true });
}
