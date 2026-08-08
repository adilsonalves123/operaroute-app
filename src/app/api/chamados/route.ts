import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import type { ChamadoPrioridade } from "@/lib/chamados/types";

export async function GET(request: Request) {
  const auth = await requireAcesso("chamados", "ver");
  if (!auth.ok) return auth.response;

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const pontoId = searchParams.get("ponto_id");
  const equipamentoId = searchParams.get("equipamento_id");
  const abertos = searchParams.get("abertos") === "1";

  let query = supabase
    .from("chamados")
    .select(
      "*, pontos(nome), equipamentos(nome, tipo, numero_maquina), chamado_eventos(id, autor_nome, tipo, texto, created_at)"
    )
    .eq("empresa_id", profile.empresa_id!)
    .order("created_at", { ascending: false })
    .limit(100);

  if (abertos) {
    query = query.in("status", ["aberta", "em_andamento"]);
  } else if (status) {
    query = query.eq("status", status);
  }
  if (pontoId) query = query.eq("ponto_id", pontoId);
  if (equipamentoId) query = query.eq("equipamento_id", equipamentoId);

  const { data, error } = await query;

  if (error) {
    const needsMigration =
      error.message.includes("chamados") || error.message.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Tabela de chamados não encontrada. Rode supabase/chamados-manutencao.sql."
          : error.message,
      },
      { status: needsMigration ? 503 : 500 }
    );
  }

  return NextResponse.json({ chamados: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAcesso("chamados", "criar");
  if (!auth.ok) return auth.response;

  const { profile, supabase } = auth;

  let body: {
    ponto_id?: string;
    equipamento_id?: string | null;
    titulo?: string;
    descricao?: string;
    prioridade?: ChamadoPrioridade;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (!body.ponto_id?.trim() || !body.titulo?.trim()) {
    return NextResponse.json(
      { error: "Ponto e título são obrigatórios." },
      { status: 400 }
    );
  }

  const prioridade = body.prioridade ?? "media";
  const descricao = body.descricao?.trim() || null;

  const { data: chamado, error } = await supabase
    .from("chamados")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      equipamento_id: body.equipamento_id || null,
      criado_por_id: profile.id,
      titulo: body.titulo.trim(),
      descricao,
      prioridade,
      status: "aberta",
    })
    .select("id")
    .single();

  if (error || !chamado) {
    return NextResponse.json({ error: error?.message ?? "Erro ao abrir chamado" }, { status: 500 });
  }

  const textoAbertura = descricao
    ? `Chamado aberto: ${descricao}`
    : `Chamado aberto: ${body.titulo.trim()}`;

  await supabase.from("chamado_eventos").insert({
    chamado_id: chamado.id,
    empresa_id: profile.empresa_id,
    autor_id: profile.id,
    autor_nome: profile.nome,
    tipo: "aberto",
    texto: textoAbertura,
  });

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "chamado.abrir",
    tabela: "chamados",
    registroId: chamado.id,
    dadosNovos: { titulo: body.titulo, prioridade, ponto_id: body.ponto_id },
    severidade: prioridade === "urgente" || prioridade === "alta" ? "medium" : "low",
    categoria: "chamado",
    modulo: "chamados",
    titulo: `Abriu chamado: ${String(body.titulo ?? "").trim()}`,
    resumo: `Prioridade ${prioridade}`,
    request,
  });

  return NextResponse.json({ success: true, id: chamado.id });
}
