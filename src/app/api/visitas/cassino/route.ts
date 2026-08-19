import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  calcularVisitaCassino,
  calcularMaquina,
  calcularTotaisVisita,
  centesimosToReais,
  parseContadorInput,
  parseComissaoPercentual,
} from "@/lib/nichos/cassino";
import type { FormaPagamento } from "@/lib/types/database";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { parseMoneyInput } from "@/lib/utils";
import { parseVisitaPontoId, vincularItemVisitaPonto } from "@/lib/visitas-ponto/vincular-item";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";
import {
  fetchSaldoCaixa,
  valorSaidaPermitidaNoCaixa,
} from "@/lib/financeiro/saldo-caixa";

interface LeituraBody {
  equipamento_id: string;
  entrada_atual: number | string;
  saida_atual: number | string;
  ia_reading_id?: string | null;
  ia_status_final?: "approved_ai" | "approved_manual" | null;
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

/** Prioriza dinheiro no teto do caixa; o que passar do saldo não vira lançamento. */
function distribuirSaidaNoTeto(pix: number, dinheiro: number, teto: number) {
  let rest = Math.max(0, teto);
  const saidaDinheiro = Math.min(Math.max(0, dinheiro), rest);
  rest -= saidaDinheiro;
  const saidaPix = Math.min(Math.max(0, pix), rest);
  return {
    pix: saidaPix,
    dinheiro: saidaDinheiro,
    total: saidaPix + saidaDinheiro,
  };
}

function brl(n: number): string {
  return n.toFixed(2).replace(".", ",");
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

/** Com valor já = saldo restante, linhas "Abatido R$" não podem ficar na descrição (senão o saldo desconta de novo). */
function descricaoHaverAposBaixa(
  observacaoAtualizada: string,
  valorAbatidoReais: number,
  visitaId: string,
  dataStr: string
): string {
  const base = observacaoAtualizada
    .split("\n")
    .filter((l) => !/Abatido R\$/i.test(l))
    .join("\n")
    .trim();
  const valorFmt = valorAbatidoReais.toFixed(2).replace(".", ",");
  const linha = `Compensado R$ ${valorFmt} na coleta de ${dataStr} [visita:${visitaId}]`;
  return base ? `${base}\n${linha}` : linha;
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();
  const visitaPontoId = parseVisitaPontoId(body.visita_ponto_id);

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

  // Evita clique duplo em "Receber agora" gravar 2 visitas + 2 entradas no caixa.
  if (visitaPontoId) {
    const { data: cassinoJaNaVisita } = await supabase
      .from("visita_ponto_itens")
      .select("id, cassino_visita_id")
      .eq("visita_ponto_id", visitaPontoId)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho", "cassino")
      .not("cassino_visita_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (cassinoJaNaVisita?.cassino_visita_id) {
      return NextResponse.json(
        {
          error:
            "Cassino já foi registrado nesta visita. Não é necessário tocar em Receber agora de novo.",
          visita_id: cassinoJaNaVisita.cassino_visita_id,
          already_done: true,
        },
        { status: 409 }
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
        .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"])
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
  const deferirPagamentoVisita =
    Boolean(visitaPontoId) && !visitaNegativa && body.receber_agora !== true;

  // No modo "continuar" (pagamento na visita ao ponto), a dívida anterior
  // entra no checkout — não pode inflar o restante da visita cassino.
  const incluirPendenciaOperacao =
    !deferirPagamentoVisita && body.incluir_pendencia_operacao === true;

  const valorPixEfetivo = deferirPagamentoVisita ? 0 : valorPix;
  const valorDinheiroEfetivo = deferirPagamentoVisita ? 0 : valorDinheiro;
  const descontoRecebimentoEfetivo = descontoRecebimento;

  if (visitaNegativa && abaterPendenciaOperacaoNegativa) {
    const { data: operacaoFresh } = await supabase
      .from("pendencias")
      .select("id, valor, descricao")
      .eq("ponto_id", body.ponto_id)
      .eq("empresa_id", profile.empresa_id)
      .eq("status", "aberta")
      .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"]);
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
        descricao: p.descricao,
        titulo: p.titulo,
      })),
      pendenciasOperacao: operacaoPendencias,
      incluirPendenciasOperacao: incluirPendenciaOperacao,
      abaterPendenciaOperacaoNegativa,
      // Haver só abate em visita positiva; negativo nunca consome haver (deixar ou acumular).
      incluirUsarHaverNegativo: false,
      descontarHaverNaCobranca: body.descontar_haver_na_cobranca === true,
      comissaoPercentual: parseComissaoPercentual(
        body.comissao_percentual ?? getComissaoPercentualNicho(ponto, "maquinas_cassino")
      ),
      descontoManualReais: descontoManualEfetivo,
      descontoRecebimentoReais: descontoRecebimentoEfetivo,
      abaterAutomatico:
        typeof body.abater_automatico === "boolean"
          ? body.abater_automatico
          : ponto.abater_automatico !== false,
      valorPixReais: valorPixEfetivo,
      valorDinheiroReais: valorDinheiroEfetivo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no cálculo da visita";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const formaPagamento = deriveFormaPagamento(valorPixEfetivo, valorDinheiroEfetivo);

  // Lucro que quita o negativo zera debitoAbatidoReais (fluxo de pagamento), mas a
  // recuperação precisa ir para visitas.debito_abatido (card Financeiro).
  const negativoRecuperadoReais =
    !calculo.saldoNegativo &&
    calculo.debitoTotalReais > 0.009 &&
    calculo.recuperacaoNegativoReais + 0.009 >= calculo.debitoTotalReais
      ? calculo.recuperacaoNegativoReais
      : calculo.debitoAbatidoReais;

  const { data: visita, error: visitaError } = await supabase
    .from("visitas")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      operador_id: profile.user_id,
      total_entrada_periodo: calculo.totalEntradaPeriodo,
      total_saida_periodo: calculo.totalSaidaPeriodo,
      total_lucro_centavos: calculo.totalLucroCentavos,
      debito_abatido: negativoRecuperadoReais,
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
    const eqRef = eqMap.get(m.equipamentoId);

    const { data: coleta, error: coletaError } = await supabase
      .from("coletas")
      .insert({
        empresa_id: profile.empresa_id,
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        equipamento_id: m.equipamentoId,
        equipamento_numero_serie: eqRef?.numero_serie?.trim() || null,
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
        comissao_percentual: getComissaoPercentualNicho(ponto, "maquinas_cassino"),
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

    if (leituraBody?.ia_reading_id && coleta?.id) {
      await supabase
        .from("ai_readings")
        .update({
          visita_id: visita.id,
          coleta_id: coleta.id,
          entrada_final: m.entradaAtual,
          saida_final: m.saidaAtual,
          final_status: leituraBody.ia_status_final ?? "approved_ai",
          corrected_by:
            leituraBody.ia_status_final === "approved_manual" ? profile.user_id : null,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", leituraBody.ia_reading_id)
        .eq("empresa_id", profile.empresa_id);
    }
  }

  for (const ab of calculo.abatimentosHaver) {
    const dataStr = new Date().toLocaleDateString("pt-BR");
    await supabase
      .from("pendencias")
      .update({
        // valor = saldo restante; descrição sem "Abatido R$" pra não descontar duas vezes
        valor: ab.saldoRestanteReais,
        descricao: descricaoHaverAposBaixa(
          ab.observacaoAtualizada,
          ab.valorAbatidoReais,
          visita.id,
          dataStr
        ),
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
    const { data: pendOp } = await supabase
      .from("pendencias")
      .select("visita_id")
      .eq("id", ab.pendenciaId)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

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

    // Espelha a baixa na visita de origem — senão o checkout vê cobravel antigo e recria dívida.
    const { sincronizarVisitaAposBaixaOperacao } = await import(
      "@/lib/visitas-ponto/sync-visita-baixa"
    );
    await sincronizarVisitaAposBaixaOperacao(supabase, {
      empresaId: profile.empresa_id,
      visitaId: pendOp?.visita_id,
      valorAbatidoReais: ab.valorAbatidoReais,
      // Negativo que consome pendência ≠ dinheiro que entrou no caixa.
      semRecebimento: calculo.saldoNegativo === true,
    });
  }

  // Registra todo recebimento da coleta no financeiro (histórico + caixa).
  // Antes só gravava quando marcado "do caixa" — recebimento sumia e o dashboard mentia.
  const pagoRecebido = deferirPagamentoVisita ? 0 : valorPixEfetivo + valorDinheiroEfetivo;

  if (pagoRecebido > 0.009) {
    const entradaPix = valorPixEfetivo;
    const entradaDinheiro = valorDinheiroEfetivo;
    const partes: string[] = [];
    if (entradaPix > 0.009) {
      partes.push(
        `Pix R$ ${entradaPix.toFixed(2).replace(".", ",")}${recebimentoPixDoCaixa ? "" : " (fora do caixa)"}`
      );
    }
    if (entradaDinheiro > 0.009) {
      partes.push(
        `Dinheiro R$ ${entradaDinheiro.toFixed(2).replace(".", ",")}${
          recebimentoDinheiroDoCaixa ? "" : " (fora do caixa)"
        }`
      );
    }
    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: "entrada",
      categoria: "Coleta cassino",
      valor: pagoRecebido,
      descricao: `Coleta - ${ponto.nome}${partes.length ? ` (${partes.join(" · ")})` : ""}`,
      forma_pagamento: deriveFormaPagamento(entradaPix, entradaDinheiro),
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      operador_id: profile.user_id,
    });
  }

  // Depois das entradas desta visita: saldo disponível para saídas (nunca abaixo de zero).
  const saldoCaixaAntesSaida = await fetchSaldoCaixa(supabase, profile.empresa_id);

  if (calculo.saldoNegativo && adiantamentoTotal > 0.009) {
    // Visita registra o valor deixado no ponto por completo; o caixa só sai até o saldo.
    const teto = valorSaidaPermitidaNoCaixa(saldoCaixaAntesSaida, adiantamentoTotal);
    const { pix: saidaPix, dinheiro: saidaDinheiro, total: saidaCaixa } =
      distribuirSaidaNoTeto(adiantamentoPix, adiantamentoDinheiro, teto);

    if (saidaCaixa > 0.009) {
      const partes: string[] = [];
      if (saidaPix > 0.009) partes.push(`Pix R$ ${brl(saidaPix)}`);
      if (saidaDinheiro > 0.009) partes.push(`Dinheiro R$ ${brl(saidaDinheiro)}`);
      const foraCaixa = adiantamentoTotal - saidaCaixa;
      let descricao = `Adiantamento negativo - ${ponto.nome}${
        partes.length ? ` (${partes.join(" · ")})` : ""
      }`;
      if (foraCaixa > 0.009) {
        descricao += ` · caixa limitado a R$ ${brl(saidaCaixa)} (resto R$ ${brl(foraCaixa)} fora do caixa)`;
      }
      await supabase.from("financeiro").insert({
        empresa_id: profile.empresa_id,
        tipo: "saida",
        categoria: "Adiantamento ponto",
        valor: saidaCaixa,
        descricao,
        forma_pagamento: deriveFormaPagamento(saidaPix, saidaDinheiro),
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        operador_id: profile.user_id,
      });
    }
  } else if (calculo.saldoNegativo && calculo.valorDeixadoOperadorReais > 0.009) {
    // Legado: só desconto_manual — sai do caixa só até o saldo.
    const desejada = calculo.valorDeixadoOperadorReais;
    const saida = valorSaidaPermitidaNoCaixa(saldoCaixaAntesSaida, desejada);
    if (saida > 0.009) {
      const foraCaixa = desejada - saida;
      let descricao = `Adiantamento negativo - ${ponto.nome} (Dinheiro R$ ${brl(saida)})`;
      if (foraCaixa > 0.009) {
        descricao += ` · caixa limitado (resto R$ ${brl(foraCaixa)} fora do caixa)`;
      }
      await supabase.from("financeiro").insert({
        empresa_id: profile.empresa_id,
        tipo: "saida",
        categoria: "Adiantamento ponto",
        valor: saida,
        descricao,
        forma_pagamento: "dinheiro",
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        operador_id: profile.user_id,
      });
    }
  } else if (
    !calculo.saldoNegativo &&
    calculo.haverQuitadoReais > 0.009 &&
    (adiantamentoTotal > 0.009 || calculo.valorDeixadoOperadorReais > 0.009)
  ) {
    // Positiva: operador paga haver ao ponto — só o que couber no caixa.
    const saidaPixDesejada = adiantamentoPix;
    const saidaDinheiroDesejada =
      adiantamentoTotal > 0.009
        ? adiantamentoDinheiro
        : calculo.valorDeixadoOperadorReais;
    const desejada = Math.min(
      saidaPixDesejada + saidaDinheiroDesejada,
      calculo.haverQuitadoReais
    );
    const teto = valorSaidaPermitidaNoCaixa(saldoCaixaAntesSaida, desejada);
    const { pix: saidaPix, dinheiro: saidaDinheiro, total: saidaCaixa } =
      distribuirSaidaNoTeto(saidaPixDesejada, saidaDinheiroDesejada, teto);

    if (saidaCaixa > 0.009) {
      const partes: string[] = [];
      if (saidaPix > 0.009) partes.push(`Pix R$ ${brl(saidaPix)}`);
      if (saidaDinheiro > 0.009) partes.push(`Dinheiro R$ ${brl(saidaDinheiro)}`);
      const foraCaixa = desejada - saidaCaixa;
      let descricao = `Pagamento haver - ${ponto.nome}${
        partes.length ? ` (${partes.join(" · ")})` : ""
      }`;
      if (foraCaixa > 0.009) {
        descricao += ` · caixa limitado a R$ ${brl(saidaCaixa)} (resto R$ ${brl(foraCaixa)} fora do caixa)`;
      }
      await supabase.from("financeiro").insert({
        empresa_id: profile.empresa_id,
        tipo: "saida",
        categoria: "Pagamento haver",
        valor: saidaCaixa,
        descricao,
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

  if (calculo.saldoNegativo && calculo.excedenteDeixadoReais > 0.009) {
    const dataStr = new Date().toLocaleDateString("pt-BR");
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      visita_id: visita.id,
      tipo: "pagamento_pendente",
      titulo: "Excedente deixado na visita",
      descricao: `Valor acima da perda da máquina — visita de ${dataStr}. Ponto deve ao operador.`,
      valor: calculo.excedenteDeixadoReais,
      status: "aberta",
      prioridade: "media",
    });
  }

  if (!calculo.saldoNegativo && !deferirPagamentoVisita && calculo.restanteOperacaoReais > 0.009) {
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
  } else if (!deferirPagamentoVisita && calculo.haverReais > 0.009) {
      await supabase.from("pendencias").insert({
        empresa_id: profile.empresa_id,
        ponto_id: body.ponto_id,
        visita_id: visita.id,
        tipo: "haver",
        titulo: "Haver do cliente",
        descricao: `Pagamento a mais (troco/crédito) na visita de ${new Date().toLocaleDateString("pt-BR")}. Total a cobrar: R$ ${calculo.totalACobrarReais.toFixed(2).replace(".", ",")}, pago: R$ ${calculo.valorPagoReais.toFixed(2).replace(".", ",")}.`,
        valor: calculo.haverReais,
        status: "aberta",
        prioridade: "baixa",
      });
  }

  await supabase
    .from("pontos")
    .update({ ultima_coleta: new Date().toISOString() })
    .eq("id", body.ponto_id);

  const visitaPontoIdLink = parseVisitaPontoId(body.visita_ponto_id);
  if (visitaPontoIdLink) {
    await vincularItemVisitaPonto({
      supabase,
      empresaId: profile.empresa_id,
      visitaPontoId: visitaPontoIdLink,
      nicho: "cassino",
      cassinoVisitaId: visita.id,
    });
  }

  const { marcarParadasConcluidasPorPonto } = await import(
    "@/lib/rotas/marcar-paradas-concluidas"
  );
  await marcarParadasConcluidasPorPonto(
    supabase,
    profile.empresa_id!,
    String(body.ponto_id ?? "")
  );

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  const { detectarDiffFinanceiro } = await import("@/lib/auditoria/anomalias");
  await auditarAcao(supabase, profile, {
    acao: "visita.criar",
    tabela: "visitas",
    registroId: visita.id,
    dadosNovos: {
      ponto_id: body.ponto_id,
      total_a_cobrar: calculo.totalACobrarReais,
      valor_pago: calculo.valorPagoReais,
      restante: calculo.restanteReais,
      haver: calculo.haverReais,
    },
    severidade: calculo.restanteReais > 0.02 || calculo.haverReais > 0.02 ? "medium" : "low",
    categoria: "coleta",
    modulo: "coletas",
    titulo: "Visita cassino registrada",
    resumo: `Cobrar R$ ${calculo.totalACobrarReais.toFixed(2)} · pago R$ ${calculo.valorPagoReais.toFixed(2)} · restante R$ ${calculo.restanteReais.toFixed(2)}`,
    request,
  });

  const anomaliaHaver = detectarDiffFinanceiro({
    esperado: calculo.totalACobrarReais,
    gravado: calculo.valorPagoReais,
    tolerancia: 0.02,
    contexto: "Visita cassino (pago vs a cobrar)",
  });
  // Só alerta se não for pendência/haver esperado de propósito — flag quando pago >> cobrado sem haver bate
  if (anomaliaHaver && Math.abs(calculo.valorPagoReais - calculo.totalACobrarReais) > 0.02) {
    // haver/restante já explicam; registra anomalia só se inconsistência interna
    if (
      calculo.haverReais < 0.01 &&
      calculo.restanteReais < 0.01 &&
      Math.abs(calculo.valorPagoReais - calculo.totalACobrarReais) > 1
    ) {
      await auditarAcao(supabase, profile, {
        acao: anomaliaHaver.codigo,
        tabela: "visitas",
        registroId: visita.id,
        severidade: anomaliaHaver.severidade,
        categoria: "anomalia",
        modulo: "coletas",
        titulo: anomaliaHaver.titulo,
        resumo: anomaliaHaver.resumo,
        meta: anomaliaHaver.meta,
        request,
      });
    }
  }

  {
    const { pushColetaRegistrada } = await import("@/lib/push/events");
    const valorPush = calculo.saldoNegativo
      ? centesimosToReais(calculo.totalLucroCentavos)
      : calculo.valorOperacaoEfetivoReais || calculo.totalACobrarReais;
    pushColetaRegistrada({
      empresaId: profile.empresa_id!,
      autorUserId: profile.user_id,
      autorNome: profile.nome,
      pontoNome: ponto?.nome ?? null,
      nichoLabel: "Cassino",
      valor: valorPush,
      url: `/coletas/visita/${visita.id}`,
    });
  }

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
