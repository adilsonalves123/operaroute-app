import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

const CAMPOS_TEXTO = ["codigo", "nome", "descricao", "categoria", "fornecedor", "observacao"] as const;
const CAMPOS_NUMERO = ["custo_unitario", "preco_venda", "quantidade", "quantidade_minima"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {};

  for (const campo of CAMPOS_TEXTO) {
    if (campo in body) {
      const v = body[campo];
      update[campo] = v === null || v === "" ? null : String(v).trim();
    }
  }

  if ("codigo" in update) {
    const codigo = update.codigo;
    if (!codigo || typeof codigo !== "string") {
      return NextResponse.json(
        { error: "Informe o código do produto (único, como número de série)." },
        { status: 400 }
      );
    }
  }

  for (const campo of CAMPOS_NUMERO) {
    if (campo in body) {
      update[campo] = Math.max(0, Number(body[campo]) || 0);
    }
  }
  if ("comissao_fixa" in body) {
    const v = body.comissao_fixa;
    update.comissao_fixa = v === null || v === undefined || v === "" ? null : Math.max(0, Number(v) || 0);
  }
  if ("ativo" in body) {
    update.ativo = Boolean(body.ativo);
  }
  if ("foto_url" in body) {
    update.foto_url = body.foto_url ? String(body.foto_url).trim() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos_consignados")
    .update(update)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

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
        {
          error: `Já existe um produto com o código "${String(update.codigo ?? "")}". O código precisa ser único.`,
        },
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
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos_consignados")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
