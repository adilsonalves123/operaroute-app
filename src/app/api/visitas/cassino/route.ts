import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  calcularVisitaCassino,
  calcularMaquina,
  calcularTotaisVisita,
  centesimosToReais,
  parseContadorInput,
  parseComissaoPercentual,
  valorMovimentoCaixa,
} from "@/lib/nichos/cassino";
import type { FormaPagamento } from "@/lib/types/database";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { parseMoneyInput } from "@/lib/utils";

interface LeituraBody {
  equipamento_id: string;
  entrada_atual: number | string;
  saida_atual: number | string;
  foto_url?: string | null;
}

function parseCentesimos(value: number | string): number {
  if (typeof value === "number") return Math.round(value);
  return parseContadorInput(String(value));
}

function deriveFormaPagamento(pix: number, dinheiro: number): FormaPagamento {
  if (pix > 0 && dinheiro > 0) return "misto";
  if (pix > 0) return "pix";
  return "dinheiro";
}

function mapPendenciasOperacao(
  rows: { id: string; valor: number | null; descricao: string | null }[] | null
) {
  return (rows ?? []).map((p) => ({
    id: p.id,
    valor: Number(p.valor ?? 0),
    observacao: p.descricao,
  }));
}

function marcarAbatimentoComVisita(descricao: string, visitaId: string): string {
  const linhas = descricao.split("\n");
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (linhas[i].startsWith("Abatido R$") && !linhas[i].includes("[visita:")) {
      linhas[i] = `${linhas[i]} [visita:${visitaId}]`;
      break;
    }
  }
  return linhas.join("\n");
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  if (!body.ponto_id || !Array.isArray(body.leituras) || body.leituras.length === 0) {
    return NextResponse.json(
      { error: "Selecione o ponto e preencha as leituras das máquinas." },
      { status: 400 }
    );
  }

  for (const l of body.leituras as LeituraBody[]) {
    if (!l.foto_url?.trim()) {
      return NextResponse.json(
        { error: "Foto obrigatória para cada máquina." },
        { status: 400 }
      );
    }
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select("*")
    .eq("id", body.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (pontoError || !ponto) {
    return NextResponse.json({ error: "Ponto não encontrado" }, { status: 404 });
  }

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("*")
    .eq("ponto_id", body.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .eq("tipo", "cassino")
    .eq("status", "ativo");

  const eqMap = new Map((equipamentos ?? []).map((e) => [e.id, e]));

  const leiturasPayload = [];
  for (const l of body.leituras as LeituraBody[]) {
    const eq = eqMap.get(l.equipamento_id);
    if (!eq) {
      return NextResponse.json(
        { error: `Equipamento não encontrado ou inativo.` },
        { status: 400 }
      );
    }
    leiturasPayload.push({
      equipamentoId: l.equipamento_id,
      nome: getEquipamentoDisplayNome(eq),
      entradaAnterior: Math.round(Number(eq.numero_entrada ?? 0)),
      saidaAnterior: Math.round(Number(eq.numero_saida ?? 0)),
      entradaAtual: parseCentesimos(l.entrada_atual),
      saidaAtual: parseCentesimos(l.saida_atual),
      fotoUri: l.foto_url ?? null,
    });
  }

  const { data: pendenciasRaw } = await supabase
    .from("pendencias")
    .select("*")
    .eq("ponto_id", body.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .eq("status", "aberta")
    .ilike("tipo", "negativo");

  const { data: haverRaw } = await supabase
    .from("pendencias")
    .select("*")
    .eq("ponto_id", body.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .eq("status", "aberta")
    .ilike("tipo", "haver");

  let operacaoPendencias = mapPendenciasOperacao(
    (
      await supabase
        .from("pendencias")
        .select("id, valor, descricao")
        .eq("ponto_id", body.ponto_id)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "aberta")
        .in("tipo", ["pagamento_pendente", "parcial"])
    ).data
  );

  const descontoManual = parseMoneyInput(body.desconto_manual);
  const descontoRecebimento = parseMoneyInput(body.desconto_recebimento);
  const valorPix = parseMoneyInput(body.valor_pix);
  const valorDinheiro = parseMoneyInput(body.valor_dinheiro);
  const adiantamentoPix = parseMoneyInput(body.adiantamento_pix);
  const adiantamentoDinheiro = parseMoneyInput(body.adiantamento_dinheiro);
  const adiantamentoPixDoCaixa = body.adiantamento_pix_do_caixa === true;
  const adiantamentoDinheiroDoCaixa =
    body.adiantamento_dinheiro_do_caixa === true || body.adiantamento_do_caixa === true;
  const recebimentoPixDoCaixa = body.recebimento_pix_do_caixa === true;
  const recebimentoDinheiroDoCaixa = body.recebimento_dinheiro_do_caixa === true;
  const adiantamentoTotal = adiantamentoPix + adiantamentoDinheiro;
  const descontoManualEfetivo =
    adiantamentoTotal > 0.009 ? adiantamentoTotal : descontoManual;

  const abaterPendenciaOperacaoNegativa =
    body.abater_pendencia_operacao_negativa !== false;
  const totaisPreview = calcularTotaisVisita(leiturasPayload.map(calcularMaquina));
  const visitaNegativa = totaisPreview.totalLucroCentavos < 0;

  if (visitaNegativa && abaterPendenciaOperacaoNegativa) {
    const { data: operacaoFresh } = await supabase
      .from("pendencias")
      .select("id, valor, descricao")
      .eq("ponto_id", body.ponto_id)
      .eq("empresa_id", profile.empresa_id)
      .eq("status", "aberta")
      .in("tipo", ["pagamento_pendente", "parcial"]);
    operacaoPendencias = mapPendenciasOperacao(operacaoFresh);
  }

  let calculo;
  try {
    calculo = calcularVisitaCassino({
      leituras: leiturasPayload,
      pendenciasNegativas: (pendenciasRaw ?? []).map((p) => ({
        id: p.id,
        valor: Number(p.valor ?? 0),
        observacao: p.descricao,
      })),
      pendenciasHaver: (haverRaw ?? []).map((p) => ({
        id: p.id,
        valor: Number(p.valor ?? 0),
        observacao: p.descricao,
      })),
      pendenciasOperacao: operacaoPendencias,
      incluirPendenciasOperacao: body.incluir_pendencia_operacao === true,
      abaterPendenciaOperacaoNegativa,
      incluirUsarHaverNegativo: body.incluir_usar_haver_negativo === true,
      comissaoPercentual: parseComissaoPercentual(
        body.comissao_percentual ?? ponto.comissao_percentual
      ),
      descontoManualReais: descontoManualEfetivo,
      descontoRecebimentoReais: descontoRecebimento,
      abaterAutomatico: ponto.abater_automatico !== false,
      valorPixReais: valorPix,
      valorDinheiroReais: valorDinheiro,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no cálculo da visita";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const formaPagamento = deriveFormaPagamento(valorPix, valorDinheiro);

  const { data: visita, error: visitaError } = await supabase
    .from("visitas")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      operador_id: profile.user_id,
      total_entrada_periodo: calculo.totalEntradaPeriodo,
      total_saida_periodo: calculo.totalSaidaPeriodo,
      total_lucro_centavos: calculo.totalLucroCentavos,
      debito_abatido: calculo.debitoAbatidoReais,
      desconto:
        calculo.saldoNegativo
          ? calculo.descontoManualReais
          : calculo.valorDeixadoOperadorReais > 0.009
            ? calculo.valorDeixadoOperadorReais
            : calculo.descontoManualReais,
      valor_cliente: calculo.valorClienteReais,
      valor_operacao: calculo.valorOperacaoReais,
      desconto_recebimento: calculo.descontoRecebimentoReais,
      valor_operacao_efetivo: calculo.valorOperacaoEfetivoReais,
      valor_pago: calculo.valorPagoReais,
      valor_pix: valorPix,
      valor_dinheiro: valorDinheiro,
      restante: calculo.restanteReais,
      forma_pagamento: formaPagamento,
      saldo_negativo: calculo.saldoNegativo,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      observacao: body.observacao ?? null,
      adiantamento_pix: adiantamentoPix,
      adiantamento_dinheiro: adiantamentoDinheiro,
      adiantamento_do_caixa: adiantamentoDinheiroDoCaixa,
      adiantamento_pix_do_caixa: adiantamentoPixDoCaixa,
      adiantamento_dinheiro_do_caixa: adiantamentoDinheiroDoCaixa,
      recebimento_pix_do_caixa: recebimentoPixDoCaixa,
      recebimento_dinheiro_do_caixa: recebimentoDinheiroDoCaixa,
    })
    .select("id")
    .maybeSingle();

  if (visitaError || !visita) {
    const msg = visitaError?.message ?? "";
    const colunaAdiantamentoFaltando =
      (msg.includes("adiantamento") ||
        msg.includes("recebimento") ||
        msg.includes("_do_caixa")) &&
      (msg.includes("does not exist") ||
        msg.includes("schema cache") ||
        msg.includes("Could not find"));
    const hint = colunaAdiantamentoFaltando
      ? "Atualize o banco: no Supabase → SQL Editor, rode o arquivo supabase/visitas-adiantamento.sql"
      : msg.includes("does not exist")
        ? "Rode supabase/cassino-visitas.sql no Supabase."
        : msg;
    return NextResponse.json({ error: hint || "Erro ao salvar visita" }, { status: 500 });
  }

  for (const m of calculo.maquinasDistribuidas) {
    const lucroReais = centesimosToReais(m.lucroCentavos);
    const leituraBody = leiturasPayload.find((l) => l.equipamentoId === m.equipamentoId);

    const { data: coleta, error: coletaError } = await supabase
      .from("coletas")
      .insert({
        empresa_id: profile.empresa_id,
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        equipamento_id: m.equipamentoId,
        operador_id: profile.user_id,
        entrada_anterior: m.entradaAnterior,
        saida_anterior: m.saidaAnterior,
        entrada_atual: m.entradaAtual,
        saida_atual: m.saidaAtual,
        entrada_periodo: m.entradaPeriodo,
        saida_periodo: m.saidaPeriodo,
        lucro_centavos: m.lucroCentavos,
        valor_cliente: m.valorClienteReais,
        valor_operacao: m.valorOperacaoReais,
        valor_bruto: lucroReais,
        comissao_percentual: Number(ponto.comissao_percentual) || 0,
        valor_comissao: m.valorClienteReais,
        valor_liquido: m.valorOperacaoReais,
        entrada: lucroReais,
        forma_pagamento: formaPagamento,
        foto_url: leituraBody?.fotoUri ?? null,
      })
      .select("id")
      .maybeSingle();

    if (coletaError) {
      return NextResponse.json(
        { error: coletaError.message, visita_id: visita.id },
        { status: 500 }
      );
    }

    await supabase
      .from("equipamentos")
      .update({
        numero_entrada: m.entradaAtual,
        numero_saida: m.saidaAtual,
      })
      .eq("id", m.equipamentoId);
  }

  for (const ab of calculo.abatimentosHaver) {
    await supabase
      .from("pendencias")
      .update({
        descricao: marcarAbatimentoComVisita(ab.observacaoAtualizada, visita.id),
        status: ab.resolvida ? "resolvida" : "aberta",
        resolvido_em: ab.resolvida ? new Date().toISOString() : null,
      })
      .eq("id", ab.pendenciaId)
      .eq("empresa_id", profile.empresa_id);
  }

  for (const ab of calculo.abatimentos) {
    await supabase
      .from("pendencias")
      .update({
        descricao: marcarAbatimentoComVisita(ab.observacaoAtualizada, visita.id),
        status: ab.resolvida ? "resolvida" : "aberta",
        resolvido_em: ab.resolvida ? new Date().toISOString() : null,
      })
      .eq("id", ab.pendenciaId)
      .eq("empresa_id", profile.empresa_id);
  }

  for (const ab of calculo.abatimentosPendenciaOperacao) {
    const { error: abOpError } = await supabase
      .from("pendencias")
      .update({
        valor: ab.valorRestanteReais,
        descricao: `${ab.descricaoAtualizada} [visita:${visita.id}]`,
        status: ab.resolvida ? "resolvida" : "aberta",
        resolvido_em: ab.resolvida ? new Date().toISOString() : null,
      })
      .eq("id", ab.pendenciaId)
      .eq("empresa_id", profile.empresa_id);

    if (abOpError) {
      return NextResponse.json(
        {
          error: `Erro ao abater pendência de operação: ${abOpError.message}`,
          visita_id: visita.id,
        },
        { status: 500 }
      );
    }
  }

  const entradaCaixa = valorMovimentoCaixa({
    pixReais: valorPix,
    dinheiroReais: valorDinheiro,
    pixDoCaixa: recebimentoPixDoCaixa,
    dinheiroDoCaixa: recebimentoDinheiroDoCaixa,
  });

  if (entradaCaixa > 0.009) {
    const entradaPix = recebimentoPixDoCaixa ? valorPix : 0;
    const entradaDinheiro = recebimentoDinheiroDoCaixa ? valorDinheiro : 0;
    const partes: string[] = [];
    if (entradaPix > 0.009) partes.push(`Pix R$ ${entradaPix.toFixed(2).replace(".", ",")}`);
    if (entradaDinheiro > 0.009) {
      partes.push(`Dinheiro R$ ${entradaDinheiro.toFixed(2).replace(".", ",")}`);
    }
    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: "entrada",
      categoria: "Coleta cassino",
      valor: entradaCaixa,
      descricao: `Coleta - ${ponto.nome}${partes.length ? ` (${partes.join(" · ")})` : ""}`,
      forma_pagamento: deriveFormaPagamento(entradaPix, entradaDinheiro),
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      operador_id: profile.user_id,
    });
  }

  if (calculo.saldoNegativo && adiantamentoTotal > 0.009) {
    const saidaCaixa = valorMovimentoCaixa({
      pixReais: adiantamentoPix,
      dinheiroReais: adiantamentoDinheiro,
      pixDoCaixa: adiantamentoPixDoCaixa,
      dinheiroDoCaixa: adiantamentoDinheiroDoCaixa,
    });
    if (saidaCaixa > 0.009) {
      const saidaPix = adiantamentoPixDoCaixa ? adiantamentoPix : 0;
      const saidaDinheiro = adiantamentoDinheiroDoCaixa ? adiantamentoDinheiro : 0;
      const partes: string[] = [];
      if (saidaPix > 0.009) partes.push(`Pix R$ ${saidaPix.toFixed(2).replace(".", ",")}`);
      if (saidaDinheiro > 0.009) {
        partes.push(`Dinheiro R$ ${saidaDinheiro.toFixed(2).replace(".", ",")}`);
      }
      await supabase.from("financeiro").insert({
        empresa_id: profile.empresa_id,
        tipo: "saida",
        categoria: "Adiantamento ponto",
        valor: saidaCaixa,
        descricao: `Adiantamento negativo - ${ponto.nome} (${partes.join(" · ")})`,
        forma_pagamento: deriveFormaPagamento(saidaPix, saidaDinheiro),
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        operador_id: profile.user_id,
      });
    }
  }

  if (calculo.saldoNegativo && calculo.haverGeradoReais > 0.009) {
    const operadorRepostou = calculo.valorDeixadoOperadorReais > 0.009;
    const dataStr = new Date().toLocaleDateString("pt-BR");

    if (operadorRepostou) {
      await supabase.from("pendencias").insert({
        empresa_id: profile.empresa_id,
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        tipo: "pagamento_pendente",
        titulo: "Pendência da visita negativa",
        descricao: `Restante do prejuízo — visita de ${dataStr}. Cliente devia cobrir.`,
        valor: calculo.haverGeradoReais,
        status: "aberta",
        prioridade: "media",
      });
    } else {
      await supabase.from("pendencias").insert({
        empresa_id: profile.empresa_id,
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        tipo: "haver",
        titulo: "Cliente pagou ganhadores",
        descricao: `Ponto pagou ganhadores na visita negativa de ${dataStr}`,
        valor: calculo.haverGeradoReais,
        status: "aberta",
        prioridade: "media",
      });
    }
  }

  if (calculo.saldoNegativo && calculo.novoDebitoReais > 0.009) {
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      tipo: "negativo",
      titulo: "Saldo negativo da coleta",
      descricao: `Valor deixado no ponto na visita de ${new Date().toLocaleDateString("pt-BR")}`,
      valor: calculo.novoDebitoReais,
      status: "aberta",
      prioridade: "alta",
    });
  }

  if (!calculo.saldoNegativo && calculo.restanteOperacaoReais > 0.009) {
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      tipo: calculo.valorPagoReais > 0 ? "parcial" : "pagamento_pendente",
      titulo: "Pagamento pendente da coleta",
      descricao: `Dívida da operação — visita de ${new Date().toLocaleDateString("pt-BR")}`,
      valor: calculo.restanteOperacaoReais,
      status: "aberta",
      prioridade: "media",
    });
  } else if (calculo.haverReais > 0.009) {
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      tipo: "haver",
      titulo: "Haver do cliente",
      descricao: `Pagamento a maior na visita de ${new Date().toLocaleDateString("pt-BR")}. Total a cobrar: R$ ${calculo.totalACobrarReais.toFixed(2).replace(".", ",")}, pago: R$ ${calculo.valorPagoReais.toFixed(2).replace(".", ",")}.`,
      valor: calculo.haverReais,
      status: "aberta",
      prioridade: "baixa",
    });
  }

  await supabase
    .from("pontos")
    .update({ ultima_coleta: new Date().toISOString() })
    .eq("id", body.ponto_id);

  return NextResponse.json({
    success: true,
    visita_id: visita.id,
    calculo: {
      totalLucroReais: centesimosToReais(calculo.totalLucroCentavos),
      valorOperacaoEfetivo: calculo.valorOperacaoEfetivoReais,
      restante: calculo.restanteReais,
      haver: calculo.haverReais,
      saldoNegativo: calculo.saldoNegativo,
    },
  });
}
