import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { transferirEstoqueParaPonto } from "@/lib/estoque/transferir-ponto";

export async function POST(request: Request) {
  const auth = await requireAcesso("estoque", "editar");
  if (!auth.ok) return auth.response;
  const { profile, supabase } = auth;

  const body = await request.json();
  const itemId = String(body.item_id ?? "").trim();
  const pontoId = String(body.ponto_id ?? "").trim();
  const quantidade = Math.floor(Number(body.quantidade) || 0);

  if (!itemId || !pontoId) {
    return NextResponse.json({ error: "Informe item e ponto." }, { status: 400 });
  }
  if (quantidade <= 0) {
    return NextResponse.json({ error: "Informe uma quantidade válida." }, { status: 400 });
  }

  const result = await transferirEstoqueParaPonto(supabase, {
    empresaId: profile.empresa_id,
    itemId,
    pontoId,
    quantidade,
    observacao: body.observacao ? String(body.observacao).trim() : undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "estoque.transferir",
    tabela: "estoque",
    registroId: itemId,
    dadosNovos: { ponto_id: pontoId, quantidade },
    severidade: "medium",
    categoria: "estoque",
    modulo: "estoque",
    titulo: "Transferiu estoque para ponto",
    resumo: `${quantidade} un. · item ${itemId} → ponto ${pontoId}`,
    request,
  });

  return NextResponse.json({ success: true });
}
