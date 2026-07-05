import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  motivoEntradaPorStatus,
  motivoSaidaPorStatus,
  registrarMovimentoPonto,
} from "@/lib/pontos-movimentos";
import type { PontoStatus } from "@/lib/types/database";

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

  const allowed = [
    "abater_automatico",
    "comissao_percentual",
    "preco_furo",
    "furos_estoque",
    "furos_minimo",
    "estoque_brindes",
    "nome",
    "status",
    "observacoes",
    "responsavel",
    "whatsapp",
    "cidade",
    "bairro",
    "endereco",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    if (key === "comissao_percentual" || key === "preco_furo") {
      updates[key] = parseFloat(body[key]) || 0;
    } else if (key === "furos_estoque") {
      updates[key] = body[key] == null || body[key] === "" ? null : Math.max(0, parseInt(body[key], 10) || 0);
    } else if (key === "furos_minimo") {
      updates[key] = Math.max(0, parseInt(body[key], 10) || 0);
    } else if (key === "estoque_brindes") {
      if (!Array.isArray(body[key])) {
        return NextResponse.json({ error: "estoque_brindes inválido" }, { status: 400 });
      }
      updates[key] = body[key].map((item: Record<string, unknown>) => ({
        item_id: typeof item.item_id === "string" ? item.item_id : undefined,
        nome: String(item.nome ?? "").trim(),
        quantidade: Math.max(0, Math.floor(Number(item.quantidade) || 0)),
        custo_unitario: Math.max(0, Number(item.custo_unitario) || 0),
      })).filter((item: { nome: string }) => item.nome);
    } else if (key === "nome") {
      updates[key] = String(body[key]).trim();
    } else if (["responsavel", "whatsapp", "cidade", "bairro", "endereco", "observacoes"].includes(key)) {
      const v = body[key];
      updates[key] = typeof v === "string" ? v.trim() || null : v ?? null;
    } else {
      updates[key] = body[key];
    }
  }

  if ("nome" in updates && !String(updates.nome ?? "").trim()) {
    return NextResponse.json({ error: "Nome do ponto é obrigatório" }, { status: 400 });
  }

  const { data: atual } = await supabase
    .from("pontos")
    .select("id, nome, status")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!atual) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  if ("status" in updates && updates.status !== atual.status) {
    const agora = new Date().toISOString();
    updates.status_alterado_em = agora;
    const novoStatus = updates.status as PontoStatus;
    const statusAnterior = atual.status as PontoStatus;

    if (novoStatus === "ativo" && statusAnterior !== "ativo") {
      await registrarMovimentoPonto(supabase, {
        empresa_id: profile.empresa_id,
        ponto_id: id,
        ponto_nome: String(updates.nome ?? atual.nome),
        tipo: "entrada",
        motivo: motivoEntradaPorStatus(statusAnterior),
      });
    } else if (novoStatus !== "ativo" && statusAnterior === "ativo") {
      await registrarMovimentoPonto(supabase, {
        empresa_id: profile.empresa_id,
        ponto_id: id,
        ponto_nome: String(updates.nome ?? atual.nome),
        tipo: "saida",
        motivo: motivoSaidaPorStatus(novoStatus),
      });
    }
  }

  let { error } = await supabase
    .from("pontos")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (
    error?.message &&
    error.message.toLowerCase().includes("status_alterado_em") &&
    "status_alterado_em" in updates
  ) {
    const { status_alterado_em: _omit, ...semDataStatus } = updates;
    ({ error } = await supabase
      .from("pontos")
      .update(semDataStatus)
      .eq("id", id)
      .eq("empresa_id", profile.empresa_id));
  }

  if (error) {
    const msg = error.message ?? "";
    const needsMigration =
      msg.includes("preco_furo") ||
      msg.includes("furos_estoque") ||
      msg.includes("estoque_brindes") ||
      msg.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Campos fura-fura não existem. Rode supabase/fura-fura-coletas.sql no Supabase."
          : msg,
      },
      { status: 500 }
    );
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

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (pontoError) {
    return NextResponse.json({ error: pontoError.message }, { status: 500 });
  }

  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  const { data: pendenciasAbertas } = await supabase
    .from("pendencias")
    .select("id, tipo")
    .eq("ponto_id", id)
    .eq("empresa_id", profile.empresa_id)
    .eq("status", "aberta");

  const pendenciasCobraveis = (pendenciasAbertas ?? []).filter((p) => p.tipo !== "haver");
  if (pendenciasCobraveis.length > 0) {
    return NextResponse.json(
      {
        error:
          "Não é possível excluir: existem pendências em aberto (negativo ou operação). Quite ou remova antes.",
      },
      { status: 400 }
    );
  }

  await registrarMovimentoPonto(supabase, {
    empresa_id: profile.empresa_id,
    ponto_id: id,
    ponto_nome: ponto.nome,
    tipo: "saida",
    motivo: "exclusao",
  });

  const { error: deleteError } = await supabase
    .from("pontos")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    mensagem: `Ponto "${ponto.nome}" excluído.`,
  });
}
