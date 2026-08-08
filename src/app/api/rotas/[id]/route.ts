import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canGerenciarRotas } from "@/lib/rotas/permissoes-rotas";

async function rotaDaEmpresa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  empresaId: string
) {
  const { data } = await supabase
    .from("rotas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data;
}

function podeOperarRota(
  rota: { operador_id: string | null },
  userId: string,
  gerencia: boolean
) {
  if (gerencia) return true;
  return rota.operador_id === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const gerencia = await canGerenciarRotas(supabase, profile, empresa?.owner_id);

  const rota = await rotaDaEmpresa(supabase, id, profile.empresa_id);
  if (!rota) {
    return NextResponse.json({ error: "Rota não encontrada." }, { status: 404 });
  }

  if (!podeOperarRota(rota, profile.user_id, gerencia)) {
    return NextResponse.json({ error: "Sem permissão nesta rota." }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "iniciar") {
    if (rota.operador_id && rota.operador_id !== profile.user_id && !gerencia) {
      return NextResponse.json({ error: "Rota atribuída a outro operador." }, { status: 403 });
    }

    const { error } = await supabase
      .from("rotas")
      .update({ status: "em_andamento" })
      .eq("id", id)
      .eq("empresa_id", profile.empresa_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "em_andamento" });
  }

  if (action === "concluir_parada" && body.parada_id) {
    const paradaId = String(body.parada_id);
    const statusParada = body.status === "pulada" ? "pulada" : "concluida";

    const { data: parada } = await supabase
      .from("rota_pontos")
      .select("id, rota_id")
      .eq("id", paradaId)
      .eq("rota_id", id)
      .maybeSingle();

    if (!parada) {
      return NextResponse.json({ error: "Parada não encontrada." }, { status: 404 });
    }

    const { error } = await supabase
      .from("rota_pontos")
      .update({ status: statusParada })
      .eq("id", paradaId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: pendentes } = await supabase
      .from("rota_pontos")
      .select("id")
      .eq("rota_id", id)
      .eq("status", "pendente");

    if (!pendentes?.length) {
      await supabase
        .from("rotas")
        .update({ status: "concluida" })
        .eq("id", id)
        .eq("empresa_id", profile.empresa_id);
    }

    return NextResponse.json({
      success: true,
      parada_status: statusParada,
      rota_concluida: !pendentes?.length,
    });
  }

  if (action === "reordenar" && Array.isArray(body.paradas)) {
    const itens = body.paradas as { parada_id: string; ordem: number }[];
    for (const item of itens) {
      if (!item.parada_id || item.ordem == null) continue;
      const { error } = await supabase
        .from("rota_pontos")
        .update({ ordem: Number(item.ordem) })
        .eq("id", String(item.parada_id))
        .eq("rota_id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true });
  }

  if (!gerencia) {
    return NextResponse.json(
      { error: "Operadores podem iniciar rota, concluir paradas ou reordenar." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.nome != null) updates.nome = String(body.nome).trim();
  if (body.status != null) updates.status = String(body.status);
  if (body.operador_id !== undefined) {
    updates.operador_id = body.operador_id ? String(body.operador_id) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("rotas")
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
  const empresa = await getEmpresa(profile.empresa_id);

  if (!(await canGerenciarRotas(supabase, profile, empresa?.owner_id))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  await supabase.from("rota_pontos").delete().eq("rota_id", id);

  const { error } = await supabase
    .from("rotas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
