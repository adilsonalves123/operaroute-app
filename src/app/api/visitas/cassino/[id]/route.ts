import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import type { SupabaseClient } from "@supabase/supabase-js";

const ABATIDO_LINE_REGEX = /Abatido R\$ ([\d.,]+)/;
const BAIXA_LINE_REGEX = /Baixa de R\$ ([\d.,]+)/;
/** Linha nova de haver quando valor já é o saldo restante. */
const COMPENSADO_LINE_REGEX = /Compensado R\$ ([\d.,]+)/;

const TIPOS_COBRANCA = ["pagamento_pendente", "parcial", "visita_consolidada"] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Remove ou reduz pendências de cobrança geradas por esta coleta quando o
 * `visita_id` não está preenchido (checkout / órfãs / SET NULL antigo).
 */
async function limparPendenciasCobrancaDaVisita(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    visitaId: string;
    visita: {
      created_at: string;
      restante?: number | null;
      valor_operacao_efetivo?: number | null;
      valor_operacao?: number | null;
      valor_pago?: number | null;
      debito_abatido?: number | null;
      saldo_negativo?: boolean | null;
    };
    visitaPontoIds: string[];
  }
) {
  if (opts.visita.saldo_negativo) return;

  const cobravel = cobravelCassinoVisita({
    valor_operacao_efetivo:
      opts.visita.valor_operacao_efetivo ?? opts.visita.valor_operacao ?? null,
    valor_pago: opts.visita.valor_pago ?? null,
    restante: opts.visita.restante ?? null,
    debito_abatido: opts.visita.debito_abatido ?? null,
  });
  const dataStr = new Date(opts.visita.created_at).toLocaleDateString("pt-BR");
  const visitaDia = new Date(opts.visita.created_at).toISOString().slice(0, 10);

  const { data: candidatas } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao, titulo, visita_id, visita_ponto_id, created_at")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId)
    .eq("status", "aberta")
    .in("tipo", [...TIPOS_COBRANCA]);

  for (const p of candidatas ?? []) {
    // Já apagadas pelo delete em visita_id; se ainda aparecerem, remove.
    if (p.visita_id === opts.visitaId) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", p.id)
        .eq("empresa_id", opts.empresaId);
      continue;
    }

    const tipo = String(p.tipo ?? "").toLowerCase();
    const desc = `${p.titulo ?? ""} ${p.descricao ?? ""}`;
    const valor = Number(p.valor ?? 0);
    const criadaNoDia =
      typeof p.created_at === "string" && p.created_at.slice(0, 10) === visitaDia;

    const textoDaColeta =
      desc.includes(`visita de ${dataStr}`) &&
      (desc.includes("Dívida da operação") ||
        desc.includes("Pagamento pendente da coleta") ||
        desc.includes("Pagamento a maior"));

    const mesmoValorDaDivida =
      cobravel > 0.009 && Math.abs(valor - cobravel) <= 0.02 && criadaNoDia;

    // Pendência direta da coleta avulsa (sem tag visita_id).
    if (
      (tipo === "pagamento_pendente" || tipo === "parcial") &&
      !p.visita_id &&
      (textoDaColeta || mesmoValorDaDivida)
    ) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", p.id)
        .eq("empresa_id", opts.empresaId);
      continue;
    }

    // Consolidada da visita ao ponto que incluía esta coleta.
    if (
      tipo === "visita_consolidada" &&
      p.visita_ponto_id &&
      opts.visitaPontoIds.includes(p.visita_ponto_id) &&
      cobravel > 0.009
    ) {
      const novo = round2(Math.max(0, valor - cobravel));
      if (novo <= 0.009) {
        await supabase
          .from("pendencias")
          .delete()
          .eq("id", p.id)
          .eq("empresa_id", opts.empresaId);
      } else {
        await supabase
          .from("pendencias")
          .update({ valor: novo })
          .eq("id", p.id)
          .eq("empresa_id", opts.empresaId);
      }
    }
  }
}

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function valorAbatimentoLinha(linha: string): number {
  const match =
    linha.match(ABATIDO_LINE_REGEX) ??
    linha.match(BAIXA_LINE_REGEX) ??
    linha.match(COMPENSADO_LINE_REGEX);
  return match ? parseValorBR(match[1]) : 0;
}

function linhaTemAbatimento(linha: string): boolean {
  return (
    ABATIDO_LINE_REGEX.test(linha) ||
    BAIXA_LINE_REGEX.test(linha) ||
    COMPENSADO_LINE_REGEX.test(linha)
  );
}

function isOperacaoTipo(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return (
    t === "pagamento_pendente" ||
    t === "parcial" ||
    t === "visita_consolidada"
  );
}

function linhaEhCompensado(linha: string): boolean {
  return COMPENSADO_LINE_REGEX.test(linha);
}

function linhaEhAbatido(linha: string): boolean {
  return ABATIDO_LINE_REGEX.test(linha);
}

/**
 * Reverte baixas desta visita na pendência.
 * Haver moderno: valor = saldo restante + linha "Compensado R$" → devolve somando.
 * Haver antigo: valor cheio + "Abatido R$" → só remove a linha (saldo sobe sozinho).
 */
function reverterPendenciaPelaVisita(
  pendencia: { tipo: string; valor: number | null; descricao: string | null },
  visitaId: string,
  dataVisita: Date,
  debitoAbatidoFallback: number
): {
  valor: number;
  descricao: string | null;
  status: string;
  resolvido_em: string | null;
  fallbackRestante: number;
  /** Quanto desta baixa foi devolvido (para reverter sync da visita origem). */
  valorAbatidoRevertido: number;
} | null {
  if (!pendencia.descricao) return null;

  const dataStr = dataVisita.toLocaleDateString("pt-BR");
  let fallbackRestante = debitoAbatidoFallback;
  let removidoCompensado = 0;
  let removidoAbatido = 0;
  let removidoBaixa = 0;
  const manter: string[] = [];
  const tipoPendencia = pendencia.tipo.toLowerCase();
  const permiteFallbackPorData =
    tipoPendencia === "haver" || isOperacaoTipo(pendencia.tipo);

  for (const linha of pendencia.descricao.split("\n")) {
    const marcada = linha.includes(`[visita:${visitaId}]`);
    /** Baixa já amarrada a outra visita — nunca reverter no fallback por data. */
    const tagOutraVisita =
      !marcada && /\[visita:[^\]]+\]/.test(linha);
    const temAbatimento = linhaTemAbatimento(linha);
    const fallbackPorDebito =
      !marcada &&
      !tagOutraVisita &&
      fallbackRestante > 0.009 &&
      temAbatimento &&
      linha.includes(`na coleta de ${dataStr}`);
    // Haver/operação: se faltou a tag [visita:], ainda reverte pela data da coleta.
    const fallbackPorData =
      permiteFallbackPorData &&
      !marcada &&
      !tagOutraVisita &&
      temAbatimento &&
      linha.includes(`na coleta de ${dataStr}`);
    const fallback = fallbackPorDebito || fallbackPorData;

    // "Compensado parcial — saldo atual" é só nota, não é baixa a reverter
    if (/Compensado parcial/i.test(linha) && !COMPENSADO_LINE_REGEX.test(linha)) {
      continue;
    }

    if (!marcada && !fallback) {
      const limpa = linha.replace(` [visita:${visitaId}]`, "").trimEnd();
      if (limpa) manter.push(limpa);
      continue;
    }

    const v = valorAbatimentoLinha(linha);
    if (v <= 0.009) {
      const limpa = linha.replace(` [visita:${visitaId}]`, "").trimEnd();
      if (limpa) manter.push(limpa);
      continue;
    }

    if (
      fallbackPorDebito &&
      !fallbackPorData &&
      removidoCompensado + removidoAbatido + removidoBaixa + v - fallbackRestante > 0.009
    ) {
      manter.push(linha.replace(` [visita:${visitaId}]`, "").trimEnd());
      continue;
    }

    if (linhaEhCompensado(linha)) removidoCompensado += v;
    else if (linhaEhAbatido(linha)) removidoAbatido += v;
    else removidoBaixa += v;

    if (fallbackPorDebito) {
      fallbackRestante = Math.max(0, fallbackRestante - v);
    }
  }

  const removido = removidoCompensado + removidoAbatido + removidoBaixa;
  if (removido <= 0.009) return null;

  const novaDescricao = manter.join("\n").trim() || null;
  const tipo = tipoPendencia;
  const valorAtual = Number(pendencia.valor ?? 0);

  let novoValor = valorAtual;
  if (isOperacaoTipo(pendencia.tipo)) {
    // Operação: valor = saldo; devolve o baixado.
    novoValor = valorAtual + removido;
  } else if (tipo === "haver") {
    // Moderno (Compensado): valor já é saldo → soma o que esta visita tirou.
    // Antigo (só Abatido): valor é o bruto → não soma; tirar a linha já restaura o saldo na UI.
    const estiloModerno =
      removidoCompensado > 0.009 ||
      /Compensado R\$/i.test(pendencia.descricao);
    if (estiloModerno) {
      novoValor = valorAtual + removido;
    }
    // else: mantém valorAtual (estilo antigo)
  }
  // Negativo: valor fica; só remove linhas Abatido.

  let status = "aberta";

  if (isOperacaoTipo(pendencia.tipo)) {
    status = novoValor > 0.009 ? "aberta" : "resolvida";
  } else if (tipo === "negativo") {
    status =
      saldoPendenciaReais({
        id: "",
        valor: novoValor,
        observacao: novaDescricao,
      }) > 0.009
        ? "aberta"
        : "resolvida";
  } else if (tipo === "haver") {
    status = novoValor > 0.009 ? "aberta" : "resolvida";
  }

  return {
    valor: novoValor,
    descricao: novaDescricao,
    status,
    resolvido_em: status === "resolvida" ? new Date().toISOString() : null,
    fallbackRestante,
    valorAbatidoRevertido: removido,
  };
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

  const { data: visita, error: visitaError } = await supabase
    .from("visitas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (visitaError) {
    return NextResponse.json({ error: visitaError.message }, { status: 500 });
  }

  if (!visita) {
    return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });
  }

  const { data: coletas, error: coletasError } = await supabase
    .from("coletas")
    .select("id, equipamento_id, entrada_anterior, saida_anterior, created_at")
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  if (coletasError) {
    return NextResponse.json({ error: coletasError.message }, { status: 500 });
  }

  const equipamentoIds = [...new Set((coletas ?? []).map((c) => c.equipamento_id).filter(Boolean))];

  if (equipamentoIds.length > 0) {
    const { data: coletaMaisNova } = await supabase
      .from("coletas")
      .select("id")
      .in("equipamento_id", equipamentoIds)
      .eq("empresa_id", profile.empresa_id)
      .gt("created_at", visita.created_at)
      .neq("visita_id", id)
      .limit(1)
      .maybeSingle();

    if (coletaMaisNova) {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir esta coleta porque existe coleta mais nova para uma das máquinas. Exclua primeiro a coleta mais recente.",
        },
        { status: 409 }
      );
    }
  }

  for (const coleta of coletas ?? []) {
    if (!coleta.equipamento_id) continue;
    await supabase
      .from("equipamentos")
      .update({
        numero_entrada: coleta.entrada_anterior,
        numero_saida: coleta.saida_anterior,
      })
      .eq("id", coleta.equipamento_id)
      .eq("empresa_id", profile.empresa_id);
  }

  await supabase
    .from("financeiro")
    .delete()
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  // Guarda vínculo com visita ao ponto antes de apagar o item.
  const { data: itensVisitaPonto } = await supabase
    .from("visita_ponto_itens")
    .select("visita_ponto_id")
    .eq("cassino_visita_id", id)
    .eq("empresa_id", profile.empresa_id);
  const visitaPontoIds = [
    ...new Set(
      (itensVisitaPonto ?? [])
        .map((i) => i.visita_ponto_id)
        .filter((v): v is string => Boolean(v))
    ),
  ];

  await supabase
    .from("visita_ponto_itens")
    .delete()
    .eq("cassino_visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  // Pendências criadas por esta visita (dívida, haver, negativo, etc.).
  const { error: delPendError } = await supabase
    .from("pendencias")
    .delete()
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  if (delPendError) {
    return NextResponse.json(
      { error: `Não foi possível remover pendências da coleta: ${delPendError.message}` },
      { status: 500 }
    );
  }

  // Cobranças órfãs / visita consolidada sem visita_id (ex.: geradas no checkout).
  await limparPendenciasCobrancaDaVisita(supabase, {
    empresaId: profile.empresa_id,
    pontoId: visita.ponto_id,
    visitaId: id,
    visita,
    visitaPontoIds,
  });

  const debitoAbatido = Number(visita.debito_abatido ?? 0);
  const { data: pendenciasPonto } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao, visita_id")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", visita.ponto_id);

  let fallbackRestante = debitoAbatido;
  const dataVisita = new Date(visita.created_at);

  const { reverterSincronizacaoVisitaAposBaixaOperacao } = await import(
    "@/lib/visitas-ponto/sync-visita-baixa"
  );

  for (const pendencia of pendenciasPonto ?? []) {
    const rollback = reverterPendenciaPelaVisita(
      pendencia,
      id,
      dataVisita,
      fallbackRestante
    );

    if (!rollback) continue;

    fallbackRestante = rollback.fallbackRestante;

    // Antes de reconciliar: devolve cobravel na visita de origem da pendência.
    if (isOperacaoTipo(pendencia.tipo) && rollback.valorAbatidoRevertido > 0.009) {
      await reverterSincronizacaoVisitaAposBaixaOperacao(supabase, {
        empresaId: profile.empresa_id,
        visitaId: pendencia.visita_id,
        valorAbatidoReais: rollback.valorAbatidoRevertido,
      });
    }

    await supabase
      .from("pendencias")
      .update({
        valor: rollback.valor,
        descricao: rollback.descricao,
        status: rollback.status,
        resolvido_em: rollback.resolvido_em,
      })
      .eq("id", pendencia.id)
      .eq("empresa_id", profile.empresa_id);
  }

  const { error: deleteError } = await supabase
    .from("visitas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Limpa órfãs que o FK antigo (SET NULL) possa ter deixado.
  try {
    const { reconciliarPendenciasCobraveisPonto } = await import(
      "@/lib/visitas-ponto/reconciliar-pendencias-ponto"
    );
    await reconciliarPendenciasCobraveisPonto(supabase, {
      empresaId: profile.empresa_id,
      pontoId: visita.ponto_id,
    });
  } catch (err) {
    console.error("[excluir-visita] reconciliar pendências", err);
  }

  const { data: visitaAnterior } = await supabase
    .from("visitas")
    .select("created_at")
    .eq("ponto_id", visita.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("pontos")
    .update({ ultima_coleta: visitaAnterior?.created_at ?? null })
    .eq("id", visita.ponto_id)
    .eq("empresa_id", profile.empresa_id);

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "visita.excluir",
    tabela: "visitas",
    registroId: id,
    dadosAnteriores: {
      ponto_id: visita.ponto_id,
      coletas: Array.isArray(coletas) ? coletas.length : 0,
    },
    severidade: "critical",
    categoria: "coleta",
    modulo: "coletas",
    titulo: "Apagou visita cassino",
    resumo: `Visita ${id} · ponto ${visita.ponto_id} — financeiro e pendências vinculados removidos.`,
  });

  return NextResponse.json({ success: true });
}
