import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import type { ChamadoStatus } from "@/lib/chamados/types";
import {
  consumirPecasNoChamado,
  textoPecasConsumidas,
  type PecaConsumoInput,
} from "@/lib/chamados/consumir-pecas";

type PatchBody = {
  action: "iniciar" | "comentario" | "concluir" | "cancelar";
  texto?: string;
  pecas?: PecaConsumoInput[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAcesso("chamados", "ver");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { profile, supabase } = auth;

  const { data: chamado, error: chamadoErr } = await supabase
    .from("chamados")
    .select("id")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id!)
    .maybeSingle();

  if (chamadoErr || !chamado) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }

  const [{ data: eventos, error }, { data: pecas }] = await Promise.all([
    supabase
      .from("chamado_eventos")
      .select("id, chamado_id, autor_nome, tipo, texto, created_at")
      .eq("chamado_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("chamado_pecas")
      .select("id, estoque_item_id, nome_item, quantidade, custo_unitario, created_at")
      .eq("chamado_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    eventos: eventos ?? [],
    pecas: pecas ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAcesso("chamados", "editar");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { profile, supabase } = auth;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { data: chamado, error: fetchErr } = await supabase
    .from("chamados")
    .select("id, status, titulo, ponto_id, pontos(nome)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id!)
    .single();

  if (fetchErr || !chamado) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }

  const status = chamado.status as ChamadoStatus;
  const texto = body.texto?.trim() ?? "";
  const agora = new Date().toISOString();

  if (body.action === "iniciar") {
    if (status !== "aberta") {
      return NextResponse.json({ error: "Só chamados abertos podem ser iniciados." }, { status: 400 });
    }
    const msg =
      texto ||
      `${profile.nome} iniciou o atendimento no ponto.`;

    const { error } = await supabase
      .from("chamados")
      .update({
        status: "em_andamento",
        responsavel_id: profile.id,
        iniciado_em: agora,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("chamado_eventos").insert({
      chamado_id: id,
      empresa_id: profile.empresa_id,
      autor_id: profile.id,
      autor_nome: profile.nome,
      tipo: "iniciado",
      texto: msg,
    });

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "chamado.iniciar",
      tabela: "chamados",
      registroId: id,
      severidade: "low",
      categoria: "chamado",
      modulo: "chamados",
      titulo: "Iniciou chamado de manutenção",
      resumo: msg,
      request,
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "comentario") {
    if (!texto) {
      return NextResponse.json({ error: "Informe o comentário." }, { status: 400 });
    }
    if (status === "concluida" || status === "cancelada") {
      return NextResponse.json({ error: "Chamado já encerrado." }, { status: 400 });
    }

    await supabase.from("chamado_eventos").insert({
      chamado_id: id,
      empresa_id: profile.empresa_id,
      autor_id: profile.id,
      autor_nome: profile.nome,
      tipo: "comentario",
      texto,
    });

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "chamado.comentario",
      tabela: "chamados",
      registroId: id,
      severidade: "info",
      categoria: "chamado",
      modulo: "chamados",
      titulo: "Comentário no chamado",
      resumo: texto.slice(0, 160),
      request,
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "concluir") {
    if (status === "concluida" || status === "cancelada") {
      return NextResponse.json({ error: "Chamado já encerrado." }, { status: 400 });
    }
    if (!texto) {
      return NextResponse.json(
        { error: "Descreva o que foi feito para concluir o chamado." },
        { status: 400 }
      );
    }

    const consumo = await consumirPecasNoChamado(
      supabase,
      profile.empresa_id!,
      id,
      Array.isArray(body.pecas) ? body.pecas : []
    );
    if (!consumo.ok) {
      return NextResponse.json({ error: consumo.error }, { status: 400 });
    }

    const textoFinal = texto + textoPecasConsumidas(consumo.consumidas);

    const { error } = await supabase
      .from("chamados")
      .update({
        status: "concluida",
        observacao_resolucao: textoFinal,
        concluido_em: agora,
        responsavel_id: profile.id,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("chamado_eventos").insert({
      chamado_id: id,
      empresa_id: profile.empresa_id,
      autor_id: profile.id,
      autor_nome: profile.nome,
      tipo: "concluido",
      texto: textoFinal,
    });

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "chamado.concluir",
      tabela: "chamados",
      registroId: id,
      severidade: "medium",
      categoria: "chamado",
      modulo: "chamados",
      titulo: "Concluiu chamado",
      resumo: textoFinal.slice(0, 180),
      request,
    });

    const pontoJoin = chamado.pontos as { nome?: string } | { nome?: string }[] | null;
    const pontoNome = Array.isArray(pontoJoin)
      ? pontoJoin[0]?.nome
      : pontoJoin?.nome;
    const { pushChamadoConcluido } = await import("@/lib/push/events");
    pushChamadoConcluido({
      empresaId: profile.empresa_id!,
      autorUserId: profile.user_id,
      autorNome: profile.nome,
      pontoNome: pontoNome ?? null,
      titulo: chamado.titulo,
      resumo: textoFinal,
      chamadoId: id,
    });

    return NextResponse.json({
      success: true,
      pecas: consumo.consumidas,
    });
  }

  if (body.action === "cancelar") {
    if (status === "concluida" || status === "cancelada") {
      return NextResponse.json({ error: "Chamado já encerrado." }, { status: 400 });
    }

    const msg = texto || `${profile.nome} cancelou o chamado.`;

    const { error } = await supabase
      .from("chamados")
      .update({ status: "cancelada", concluido_em: agora })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("chamado_eventos").insert({
      chamado_id: id,
      empresa_id: profile.empresa_id,
      autor_id: profile.id,
      autor_nome: profile.nome,
      tipo: "cancelado",
      texto: msg,
    });

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "chamado.cancelar",
      tabela: "chamados",
      registroId: id,
      severidade: "high",
      categoria: "chamado",
      modulo: "chamados",
      titulo: "Cancelou chamado",
      resumo: msg,
      request,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
