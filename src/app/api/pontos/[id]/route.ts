import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { devolverEstoqueBrindesPontoParaCentral } from "@/lib/estoque/transferir-ponto";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
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
    "comissao_por_nicho",
    "consignado_modo_comissao",
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
    "latitude",
    "longitude",
    "foto_url",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    if (key === "comissao_percentual" || key === "preco_furo") {
      updates[key] = parseFloat(body[key]) || 0;
    } else if (key === "latitude" || key === "longitude") {
      const raw = body[key];
      if (raw == null || raw === "") {
        updates[key] = null;
      } else {
        const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
        updates[key] = Number.isFinite(n) ? n : null;
      }
    } else if (key === "comissao_por_nicho") {
      const raw = body[key];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json({ error: "comissao_por_nicho inválido" }, { status: 400 });
      }
      const map: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        map[k] = Math.max(0, Math.min(100, Number(v) || 0));
      }
      updates[key] = map;
    } else if (key === "consignado_modo_comissao") {
      updates[key] = body[key] === "tabela" ? "tabela" : "percentual";
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
    } else if (key === "foto_url") {
      const v = body[key];
      updates[key] = typeof v === "string" && v.trim() ? v.trim() : null;
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
    if (/comissao_por_nicho|consignado_modo_comissao/i.test(msg) || msg.includes("schema cache")) {
      return NextResponse.json(
        {
          error:
            "Coluna de comissão por nicho ausente. Rode supabase/comissao-por-nicho.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
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

  const { registrarAuditoria, requestMeta } = await import("@/lib/auditoria/registrar");
  const meta = requestMeta(request);
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: profile.email,
    acao: "ponto.editar",
    tabela: "pontos",
    registroId: id,
    dadosAnteriores: { nome: atual.nome, status: atual.status },
    dadosNovos: updates,
    severidade: "status" in updates ? "high" : "medium",
    categoria: "ponto",
    modulo: "pontos",
    titulo: `Editou ponto ${atual.nome}`,
    resumo: Object.keys(updates).join(", "),
    ip: meta.ip,
    userAgent: meta.userAgent,
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

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("id, nome, status, estoque_brindes")
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

  const estoqueBrindes = normalizarEstoqueBrindesPonto(ponto.estoque_brindes);
  if (estoqueBrindes.length > 0) {
    const devolucao = await devolverEstoqueBrindesPontoParaCentral(supabase, {
      empresaId: profile.empresa_id,
      pontoId: id,
      brindes: estoqueBrindes,
      observacao: `Exclusão do ponto "${ponto.nome}" — saldo restante devolvido ao central`,
      tipoMovimento: "devolucao_ponto",
    });

    if (devolucao.error) {
      return NextResponse.json(
        { error: `Não foi possível devolver o estoque ao central: ${devolucao.error}` },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("pontos")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "ponto.excluir",
    tabela: "pontos",
    registroId: id,
    dadosAnteriores: { nome: ponto.nome, status: ponto.status },
    severidade: "critical",
    categoria: "ponto",
    modulo: "pontos",
    titulo: `Excluiu ponto ${ponto.nome}`,
    resumo: `Estoque devolvido: ${estoqueBrindes.reduce((sum, item) => sum + item.quantidade, 0)} un.`,
  });

  return NextResponse.json({
    success: true,
    mensagem: `Ponto "${ponto.nome}" excluído.`,
    estoque_devolvido: estoqueBrindes.reduce((sum, item) => sum + item.quantidade, 0),
  });
}
