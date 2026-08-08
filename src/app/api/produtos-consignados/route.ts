import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos_consignados")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("nome");

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
  const nome = String(body.nome ?? "").trim();
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do produto." }, { status: 400 });
  }

  const codigo = String(body.codigo ?? "").trim();
  if (!codigo) {
    return NextResponse.json(
      { error: "Informe o código do produto (único, como número de série)." },
      { status: 400 }
    );
  }

  const comissaoFixaRaw = body.comissao_fixa;
  const comissaoFixa =
    comissaoFixaRaw === null || comissaoFixaRaw === undefined || comissaoFixaRaw === ""
      ? null
      : Math.max(0, Number(comissaoFixaRaw) || 0);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos_consignados")
    .insert({
      empresa_id: profile.empresa_id,
      codigo,
      nome,
      descricao: body.descricao ? String(body.descricao).trim() : null,
      categoria: body.categoria ? String(body.categoria).trim() : null,
      custo_unitario: Math.max(0, Number(body.custo_unitario) || 0),
      preco_venda: Math.max(0, Number(body.preco_venda) || 0),
      comissao_fixa: comissaoFixa,
      quantidade: Math.max(0, Math.floor(Number(body.quantidade) || 0)),
      quantidade_minima: Math.max(0, Math.floor(Number(body.quantidade_minima) || 0)),
      fornecedor: body.fornecedor ? String(body.fornecedor).trim() : null,
      observacao: body.observacao ? String(body.observacao).trim() : null,
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.message ?? "";
    if (/permission denied for (table|relation) produtos_consignados/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Sem permissão na tabela produtos_consignados. Rode supabase/produtos-consignados-permissoes.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
    if (
      error.code === "23505" ||
      msg.includes("uq_produtos_consignados_codigo") ||
      msg.toLowerCase().includes("duplicate")
    ) {
      return NextResponse.json(
        { error: `Já existe um produto com o código "${codigo}". O código precisa ser único.` },
        { status: 409 }
      );
    }
    if (msg.includes("descricao") || msg.includes("schema cache")) {
      return NextResponse.json(
        {
          error:
            "Coluna descricao ausente. Rode supabase/produtos-consignados-descricao.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.id) {
    return NextResponse.json(
      { error: "Produto não retornou id. Verifique permissões RLS de produtos_consignados." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id });
}
