import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { buscarHistoricoPorNumeroSerie } from "@/lib/equipamentos/buscar-historico-serie";
import { parseLeituraContador, isEquipamentoTipoDiversao } from "@/lib/equipamentos";
import { createClient, getProfile, getSession } from "@/lib/supabase/server";
import { devolverTodoEstoqueMaquinaParaPonto } from "@/lib/estoque/transferir-maquina";
import { diffCampos, registrarAuditoria, requestMeta } from "@/lib/auditoria/registrar";
import {
  detectarContadorRegressivo,
  detectarSaltoContador,
} from "@/lib/auditoria/anomalias";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { getEmpresa } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const auth = await requireAcesso("pontos", "ver");
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth;
  const { data: equipamento, error } = await supabase
    .from("equipamentos")
    .select("*, pontos(id, nome)")
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  const historicoSerie =
    (equipamento.tipo === "cassino" ||
      equipamento.tipo === "ursinho" ||
      equipamento.tipo === "bolinha" ||
      isEquipamentoTipoDiversao(equipamento.tipo)) &&
    equipamento.numero_serie
      ? await buscarHistoricoPorNumeroSerie(
          supabase,
          profile.empresa_id!,
          equipamento.numero_serie,
          { pontoAtualId: equipamento.ponto_id, limiteColetas: 6 }
        )
      : null;

  const ultimaLeitura =
    historicoSerie?.coletas[0] ??
    (equipamento.tipo === "ursinho" ||
    equipamento.tipo === "vending_ursinho" ||
    equipamento.tipo === "bolinha" ||
    isEquipamentoTipoDiversao(equipamento.tipo)
      ? {
          id: equipamento.id,
          visita_id: null,
          created_at: equipamento.created_at,
          entrada_anterior: null,
          saida_anterior: null,
          entrada_atual: equipamento.entrada_atual,
          saida_atual: null,
          entrada_periodo: equipamento.entrada_atual,
          saida_periodo: null,
          lucro_centavos: null,
          foto_url: equipamento.foto_url,
          ponto_id: equipamento.ponto_id,
          ponto_nome: equipamento.pontos?.nome ?? null,
          equipamento_nome: equipamento.nome,
        }
      : null);

  const { data: ultimaManutencao, error: manutencaoError } = await supabase
    .from("chamados")
    .select(
      "id, titulo, status, prioridade, descricao, observacao_resolucao, created_at, iniciado_em, concluido_em"
    )
    .eq("empresa_id", profile.empresa_id)
    .eq("equipamento_id", equipamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (manutencaoError) {
    return NextResponse.json({ error: manutencaoError.message }, { status: 500 });
  }

  return NextResponse.json({
    equipamento,
    historicoSerie,
    ultimaLeitura,
    ultimaManutencao: ultimaManutencao ?? null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const auth = await requireAcesso("pontos", "editar");
  if (!auth.ok) return auth.response;
  const { profile, acesso } = auth;
  const metaReq = requestMeta(request);

  const body = await request.json();
  const camposPermitidos = [
    "foto_url",
    "nome",
    "numero_maquina",
    "numero_serie",
    "numero_entrada",
    "numero_saida",
    "entrada_atual",
    "preco_jogada",
    "observacao",
    "status",
  ];
  const temCampo = camposPermitidos.some((campo) => campo in body);
  if (!temCampo) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("equipamentos")
    .select(
      "id, tipo, nome, numero_maquina, numero_serie, numero_entrada, numero_saida, entrada_atual, preco_jogada, observacao, status, ponto_id, foto_url"
    )
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!atual) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if ("foto_url" in body) patch.foto_url = body.foto_url ?? null;
  if ("nome" in body) patch.nome = String(body.nome ?? "").trim();
  if ("numero_maquina" in body) patch.numero_maquina = String(body.numero_maquina ?? "").trim();
  if ("observacao" in body) patch.observacao = String(body.observacao ?? "").trim() || null;
  if ("status" in body) patch.status = String(body.status ?? "ativo").trim() || "ativo";

  if (
    atual.tipo === "cassino" ||
    atual.tipo === "ursinho" ||
    atual.tipo === "bolinha" ||
    isEquipamentoTipoDiversao(atual.tipo)
  ) {
    if ("numero_serie" in body) {
      patch.numero_serie = String(body.numero_serie ?? "").trim() || null;
    }
  }

  if (atual.tipo === "cassino") {
    if ("numero_entrada" in body) {
      patch.numero_entrada = body.numero_entrada
        ? parseLeituraContador(String(body.numero_entrada))
        : null;
    }
    if ("numero_saida" in body) {
      patch.numero_saida = body.numero_saida
        ? parseLeituraContador(String(body.numero_saida))
        : null;
    }
  }

  if (
    (atual.tipo === "ursinho" ||
      atual.tipo === "vending_ursinho" ||
      isEquipamentoTipoDiversao(atual.tipo)) &&
    "entrada_atual" in body
  ) {
    patch.entrada_atual = body.entrada_atual
      ? parseLeituraContador(String(body.entrada_atual))
      : null;
  }

  if (atual.tipo === "bolinha" && "preco_jogada" in body) {
    const n = Number(String(body.preco_jogada ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: "Informe o valor da jogada (ex.: 2,00)" },
        { status: 400 }
      );
    }
    patch.preco_jogada = Math.round(n * 100) / 100;
  }

  if (atual.tipo === "bolinha" && "entrada_atual" in body) {
    patch.entrada_atual = body.entrada_atual
      ? parseLeituraContador(String(body.entrada_atual))
      : 0;
  }

  if ("nome" in body && !String(patch.nome ?? "").trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if ("numero_maquina" in body && !String(patch.numero_maquina ?? "").trim()) {
    return NextResponse.json({ error: "Número da máquina é obrigatório." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("equipamentos")
    .update(patch)
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("foto_url") || msg.includes("schema cache")) {
      return NextResponse.json(
        {
          error:
            "Coluna foto_url não existe. Rode supabase/equipamentos-foto.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  const { anteriores, novos, mudou } = diffCampos(
    atual as unknown as Record<string, unknown>,
    data as unknown as Record<string, unknown>,
    camposPermitidos
  );

  const labelEq =
    [atual.numero_maquina && `Nº ${atual.numero_maquina}`, atual.nome]
      .filter(Boolean)
      .join(" · ") || equipamentoId;

  const session = await getSession();
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id!,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: session?.email ?? profile.email,
    userRole: acesso.role,
    acao: "equipamento.editar",
    tabela: "equipamentos",
    registroId: equipamentoId,
    dadosAnteriores: anteriores,
    dadosNovos: novos,
    severidade: mudou.some((c) =>
      ["numero_entrada", "numero_saida", "entrada_atual"].includes(c)
    )
      ? "high"
      : "medium",
    categoria: "equipamento",
    modulo: "pontos",
    titulo: `Editou equipamento ${labelEq}`,
    resumo:
      mudou.length > 0
        ? `Campos: ${mudou.join(", ")}`
        : "Atualização sem mudança detectada",
    ip: metaReq.ip,
    userAgent: metaReq.userAgent,
  });

  const anomalias = [
    detectarContadorRegressivo({
      label: "Entrada",
      campo: "numero_entrada",
      anterior: atual.numero_entrada as number | null,
      atual: data.numero_entrada as number | null,
    }),
    detectarContadorRegressivo({
      label: "Saída",
      campo: "numero_saida",
      anterior: atual.numero_saida as number | null,
      atual: data.numero_saida as number | null,
    }),
    detectarContadorRegressivo({
      label: "Visor",
      campo: "entrada_atual",
      anterior: atual.entrada_atual as number | null,
      atual: data.entrada_atual as number | null,
    }),
    detectarSaltoContador({
      label: "Entrada",
      campo: "numero_entrada",
      anterior: atual.numero_entrada as number | null,
      atual: data.numero_entrada as number | null,
    }),
    detectarSaltoContador({
      label: "Saída",
      campo: "numero_saida",
      anterior: atual.numero_saida as number | null,
      atual: data.numero_saida as number | null,
    }),
  ].filter(Boolean);

  for (const an of anomalias) {
    if (!an) continue;
    await registrarAuditoria({
      supabase,
      empresaId: profile.empresa_id!,
      userId: profile.user_id,
      userNome: profile.nome,
      userEmail: session?.email ?? profile.email,
      userRole: acesso.role,
      acao: an.codigo,
      tabela: "equipamentos",
      registroId: equipamentoId,
      dadosAnteriores: anteriores,
      dadosNovos: novos,
      severidade: an.severidade,
      categoria: "anomalia",
      modulo: "pontos",
      titulo: `${an.titulo} · ${labelEq}`,
      resumo: an.resumo,
      ip: metaReq.ip,
      userAgent: metaReq.userAgent,
      meta: an.meta,
    });
  }

  return NextResponse.json({ success: true, equipamento: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, nome, numero_maquina, ponto_id, estoque_brindes")
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (eqError) {
    return NextResponse.json({ error: eqError.message }, { status: 500 });
  }

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  const devolucao = await devolverTodoEstoqueMaquinaParaPonto(supabase, {
    empresaId: profile.empresa_id,
    equipamentoId,
  });

  if (devolucao.error) {
    return NextResponse.json(
      { error: `Não foi possível devolver brindes ao ponto: ${devolucao.error}` },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase
    .from("equipamentos")
    .delete()
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const nome =
    equipamento.numero_maquina && equipamento.nome
      ? `Nº ${equipamento.numero_maquina} · ${equipamento.nome}`
      : equipamento.nome;

  const session = await getSession();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: session?.email ?? profile.email,
    userRole: acesso.role,
    acao: "equipamento.excluir",
    tabela: "equipamentos",
    registroId: equipamentoId,
    dadosAnteriores: equipamento as unknown as Record<string, unknown>,
    severidade: "high",
    categoria: "equipamento",
    modulo: "pontos",
    titulo: `Removeu equipamento ${nome}`,
    resumo: "Equipamento apagado; histórico de coletas permanece.",
  });

  return NextResponse.json({
    success: true,
    mensagem: `${nome} removido do ponto. O histórico de coletas antigas permanece no sistema.`,
  });
}
