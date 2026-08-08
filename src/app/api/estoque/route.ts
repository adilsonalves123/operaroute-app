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
      descricao: body.descricao ? String(body.descricao).trim() : null,
      categoria: String(body.categoria ?? "Brindes").trim() || "Brindes",
      custo_unitario: Math.max(0, Number(body.custo_unitario) || 0),
      quantidade: Math.max(0, Math.floor(Number(body.quantidade) || 0)),
      quantidade_minima: Math.max(0, Math.floor(Number(body.quantidade_minima) || 0)),
      fornecedor: body.fornecedor ? String(body.fornecedor).trim() : null,
      observacao: body.observacao ? String(body.observacao).trim() : null,
    })
    .select("id")
    .single();

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

  if (!data?.id) {
    return NextResponse.json(
      { error: "Item não retornou id. Verifique permissões RLS da tabela estoque." },
      { status: 500 }
    );
  }

  if (Number(body.quantidade) > 0) {
    const { error: movErr } = await supabase.from("estoque_movimentacoes").insert({
      empresa_id: profile.empresa_id,
      item_id: data.id,
      tipo: "entrada",
      quantidade: Math.floor(Number(body.quantidade)),
      observacao: "Cadastro inicial",
    });
    if (movErr) {
      // Item já criado — não falha o cadastro por causa do histórico.
      console.error("estoque_movimentacoes:", movErr.message);
    }
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "estoque.criar",
    tabela: "estoque",
    registroId: data.id,
    dadosNovos: {
      nome_item: nome,
      quantidade: Math.floor(Number(body.quantidade) || 0),
      categoria: String(body.categoria ?? "Brindes"),
    },
    severidade: "low",
    categoria: "estoque",
    modulo: "estoque",
    titulo: "Cadastrou item no estoque",
    resumo: `${nome} · qtd ${Math.floor(Number(body.quantidade) || 0)}`,
    request,
  });

  return NextResponse.json({ success: true, id: data.id });
}
