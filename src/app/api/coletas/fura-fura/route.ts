import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  calcularColetaFuraFura,
  calcularRecebimentoComPendencia,
  NICHO_MODULO_FURA_FURA,
  parseRecebimentoPixDinheiro,
  validarBrindesContraEstoquePonto,
  validarQuantidadeFurosColeta,
  registrarHaverFuraFura,
  splitExcedentePagamento,
  type BrindeEntregue,
  type EstoqueBrindePonto,
} from "@/lib/nichos/fura-fura";
import { baixarHaverNicho, somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import {
  carregarKitCompleto,
  validarBrindesContraPremiosKit,
  type FuraKitPremio,
  type FuraKitReposicaoItem,
} from "@/lib/nichos/fura-fura/kits";
import { formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";
import { parseVisitaPontoId, vincularItemVisitaPonto } from "@/lib/visitas-ponto/vincular-item";
import {
  aplicarPagamentoDividaAnterior,
} from "@/lib/visitas-ponto/checkout";
import { totalDividaAnteriorPonto } from "@/lib/visitas-ponto/divida-ponto";
import { getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";

function parseBrindes(raw: unknown): BrindeEntregue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => ({
      item_id: typeof b.item_id === "string" ? b.item_id : undefined,
      nome: String(b.nome ?? "Brinde"),
      quantidade: Math.max(0, Math.floor(Number(b.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(b.custo_unitario) || 0),
    }))
    .filter((b) => b.quantidade > 0);
}

function deduzirEstoquePonto(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntregue[]
): EstoqueBrindePonto[] {
  const next = estoque.map((e) => ({ ...e }));
  for (const b of brindes) {
    const idx = b.item_id
      ? next.findIndex((e) => e.item_id === b.item_id)
      : next.findIndex((e) => e.nome === b.nome);
    if (idx >= 0) {
      next[idx].quantidade = Math.max(0, (next[idx].quantidade ?? 0) - b.quantidade);
    }
  }
  return next;
}

export async function POST(request: Request) {
  try {
    return await postColetaFuraFura(request);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao registrar coleta fura-fura.",
      },
      { status: 400 }
    );
  }
}

async function postColetaFuraFura(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  if (!nichosAtivos.includes("fura_fura")) {
    return NextResponse.json(
      { error: "Nicho fura-fura não está ativo nesta operação." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const supabase = await createClient();
  const visitaPontoId = parseVisitaPontoId(body.visita_ponto_id);
  const receberAgora = Boolean(body.receber_agora);
  const modoVisitaPonto = Boolean(visitaPontoId);
  const cobrandoAgora = !modoVisitaPonto || receberAgora;
  const descontarHaverNaCobranca = body.descontar_haver_na_cobranca === true;
  // body.incluir_pendencia_operacao: só afeta o total sugerido na UI

  if (visitaPontoId) {
    const { data: visitaAberta } = await supabase
      .from("visitas_ponto")
      .select("id, status")
      .eq("id", visitaPontoId)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();
    if (!visitaAberta) {
      return NextResponse.json({ error: "Visita ao ponto não encontrada." }, { status: 400 });
    }
    if (visitaAberta.status !== "rascunho") {
      return NextResponse.json(
        {
          error:
            "Esta visita já foi finalizada. Volte ao ponto e inicie uma nova visita para continuar coletando.",
        },
        { status: 400 }
      );
    }
  }

  const pontoId = String(body.ponto_id ?? "").trim();
  if (!pontoId) {
    return NextResponse.json({ error: "Selecione um ponto." }, { status: 400 });
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select(
      "id, nome, comissao_percentual, comissao_por_nicho, preco_furo, furos_estoque, estoque_brindes, whatsapp, kit_ativo_id"
    )
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (pontoError || !ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  let kitId: string | null = ponto.kit_ativo_id ?? null;
  let kitNome: string | null = null;
  let premiosKit: FuraKitPremio[] = [];
  let reposicaoKit: FuraKitReposicaoItem[] = [];

  if (kitId) {
    const loaded = await carregarKitCompleto(supabase, kitId, profile.empresa_id);
    if ("error" in loaded && loaded.error) {
      kitId = null;
    } else if (!("error" in loaded)) {
      kitNome = loaded.kit.nome;
      premiosKit = loaded.premios as FuraKitPremio[];
      reposicaoKit = loaded.reposicao as FuraKitReposicaoItem[];
    }
  }

  const brindes = parseBrindes(body.brindes);
  const estoqueBrindes: EstoqueBrindePonto[] = Array.isArray(ponto.estoque_brindes)
    ? (ponto.estoque_brindes as EstoqueBrindePonto[]).map((e) => ({
        item_id: e.item_id,
        nome: String(e.nome ?? ""),
        quantidade: Math.max(0, Math.floor(Number(e.quantidade) || 0)),
        custo_unitario: Number(e.custo_unitario ?? 0),
      }))
    : [];

  if (brindes.length > 0) {
    const erroBrindes = kitId
      ? validarBrindesContraPremiosKit(brindes, premiosKit, estoqueBrindes, reposicaoKit)
      : validarBrindesContraEstoquePonto(brindes, estoqueBrindes);
    if (erroBrindes) {
      return NextResponse.json({ error: erroBrindes }, { status: 400 });
    }
  }

  const recebimento = cobrandoAgora
    ? parseRecebimentoPixDinheiro(body)
    : { ok: true as const, data: { pix: 0, dinheiro: 0, total: 0, forma: "dinheiro" as const } };
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const precoFuro =
    body.preco_furo != null && body.preco_furo !== ""
      ? Number(body.preco_furo)
      : Number(ponto.preco_furo ?? 1);

  const calculo = calcularColetaFuraFura({
    quantidadeFuros: Number(body.quantidade_furos) || 0,
    precoFuro,
    comissaoPercentual:
      body.comissao_percentual != null && body.comissao_percentual !== ""
        ? Number(body.comissao_percentual)
        : getComissaoPercentualNicho(ponto, "fura_fura"),
    desconto: Number(body.desconto) || 0,
    brindes,
    valorPagoRecebido: cobrandoAgora ? recebimento.data.total : 0,
  });

  if (calculo.quantidadeFuros <= 0) {
    return NextResponse.json({ error: "Informe a quantidade de furos." }, { status: 400 });
  }

  const erroFuros = validarQuantidadeFurosColeta(
    calculo.quantidadeFuros,
    ponto.furos_estoque
  );
  if (erroFuros) {
    return NextResponse.json({ error: erroFuros }, { status: 400 });
  }

  // Dívida universal do ponto (visita consolidada + demais cobráveis) — mesmo total em todo nicho.
  const dividaPonto = cobrandoAgora
    ? await totalDividaAnteriorPonto(supabase, profile.empresa_id, pontoId)
    : 0;
  const pendenciaAnterior = dividaPonto;

  let haverAbatido = 0;
  if (cobrandoAgora && descontarHaverNaCobranca) {
    const { data: havers } = await supabase
      .from("pendencias")
      .select("tipo, titulo, valor")
      .eq("empresa_id", profile.empresa_id)
      .eq("ponto_id", pontoId)
      .eq("status", "aberta")
      .ilike("tipo", "haver");
    const haverSaldo = somarHaverNichoAberto(havers ?? [], "fura-fura");
    haverAbatido = Math.min(haverSaldo, calculo.valorAReceber);
  }

  const valorCobrancaAtual = Math.max(0, calculo.valorAReceber - haverAbatido);

  const recebimentoRateado = calcularRecebimentoComPendencia(
    valorCobrancaAtual,
    recebimento.data.total,
    pendenciaAnterior
  );

  const pixRestante = { v: recebimento.data.pix };
  const dinheiroRestante = { v: recebimento.data.dinheiro };
  const pagamentoColetaAtual = splitExcedentePagamento(
    recebimentoRateado.aplicadoColetaAtual,
    pixRestante,
    dinheiroRestante
  );

  if (!body.foto_url) {
    return NextResponse.json({ error: "Foto da máquina é obrigatória." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const coletaInsert = {
    empresa_id: profile.empresa_id,
    ponto_id: pontoId,
    operador_id: user?.id ?? null,
    nicho_modulo: NICHO_MODULO_FURA_FURA,
    quantidade_furos: calculo.quantidadeFuros,
    preco_furo: calculo.precoFuro,
    valor_bruto: calculo.valorBruto,
    comissao_percentual: calculo.comissaoPercentual,
    valor_comissao: calculo.valorComissao,
    valor_liquido: calculo.lucroReal,
    valor_pago_ponto: calculo.valorComissao,
    desconto: calculo.desconto,
    valor_a_receber: calculo.valorAReceber,
    valor_pago_recebido: Math.round(
      (recebimentoRateado.aplicadoColetaAtual + haverAbatido) * 100
    ) / 100,
    valor_pix: recebimento.data.pix,
    valor_dinheiro: recebimento.data.dinheiro,
    custo_brindes: calculo.custoBrindes,
    lucro_real: calculo.lucroReal,
    brindes_entregues: brindes,
    brindes_repostos: body.brindes_repostos ? Number(body.brindes_repostos) : null,
    brindes_restantes: body.brindes_restantes ? Number(body.brindes_restantes) : null,
    forma_pagamento: recebimento.data.forma,
    foto_url: body.foto_url ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    relatorio_enviado: Boolean(body.relatorio_enviado),
    observacao: body.observacao ?? null,
    kit_id: kitId,
    kit_nome: kitNome,
  };

  const { data: coleta, error: coletaError } = await supabase
    .from("coletas")
    .insert(coletaInsert)
    .select("id")
    .single();

  if (coletaError || !coleta) {
    const msg = coletaError?.message ?? "Erro ao registrar coleta.";
    const needsMigration =
      msg.includes("nicho_modulo") ||
      msg.includes("valor_a_receber") ||
      msg.includes("kit_id") ||
      msg.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/fura-fura-coletas.sql no Supabase SQL Editor."
          : msg,
      },
      { status: 500 }
    );
  }

  const pontoUpdates: Record<string, unknown> = {
    ultima_coleta: new Date().toISOString(),
  };

  if (ponto.furos_estoque != null) {
    pontoUpdates.furos_estoque = Math.max(
      0,
      Number(ponto.furos_estoque) - calculo.quantidadeFuros
    );
  }

  if (brindes.length > 0 && Array.isArray(ponto.estoque_brindes)) {
    pontoUpdates.estoque_brindes = deduzirEstoquePonto(
      ponto.estoque_brindes as EstoqueBrindePonto[],
      brindes
    );
  }

  await supabase.from("pontos").update(pontoUpdates).eq("id", pontoId);

  // Espelha a foto no equipamento do ponto (como ursinho/bolinha) para a próxima coleta.
  const fotoUrlSalva = String(body.foto_url ?? "").trim();
  if (fotoUrlSalva) {
    await supabase
      .from("equipamentos")
      .update({ foto_url: fotoUrlSalva })
      .eq("empresa_id", profile.empresa_id)
      .eq("ponto_id", pontoId)
      .eq("tipo", "fura_fura");
  }

  let haverGerado = 0;

  if (cobrandoAgora && recebimentoRateado.aplicadoColetaAtual > 0.009) {
    const pagamentoDetalhe = formatPagamentoDetalhe(
      pagamentoColetaAtual.pix,
      pagamentoColetaAtual.dinheiro
    );

    await supabase.from("coleta_pagamentos").insert({
      empresa_id: profile.empresa_id,
      coleta_id: coleta.id,
      ponto_id: pontoId,
      valor: recebimentoRateado.aplicadoColetaAtual,
      valor_pix: pagamentoColetaAtual.pix,
      valor_dinheiro: pagamentoColetaAtual.dinheiro,
      forma_pagamento: recebimento.data.forma,
      observacao: modoVisitaPonto ? "Pagamento na coleta (receber na visita)" : "Pagamento na coleta",
      operador_id: user?.id ?? null,
    });

    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: "entrada",
      categoria: "Coleta fura-fura",
      valor: recebimentoRateado.aplicadoColetaAtual,
      descricao: pagamentoDetalhe
        ? `Coleta ${ponto.nome} — ${pagamentoDetalhe}`
        : `Coleta ${ponto.nome}`,
      forma_pagamento: recebimento.data.forma,
      ponto_id: pontoId,
      coleta_id: coleta.id,
      operador_id: user?.id ?? null,
    });
  }

  // Pendência nova só fora da visita (na visita o Cobrar consolida).
  if (!modoVisitaPonto && recebimentoRateado.saldoPendenteColeta > 0.009) {
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: pontoId,
      coleta_id: coleta.id,
      tipo: recebimentoRateado.aplicadoColetaAtual > 0.009 ? "parcial" : "pagamento_pendente",
      titulo: "Coleta fura-fura pendente",
      descricao: `Saldo da coleta de ${new Date().toLocaleDateString("pt-BR")} — ${ponto.nome}`,
      valor: recebimentoRateado.saldoPendenteColeta,
      prioridade: "media",
      status: "aberta",
    });
  }

  // Abate dívida universal do ponto + haver também ao "Receber" na visita-ponto.
  if (cobrandoAgora) {
    if (recebimentoRateado.aplicadoDividaAnterior > 0.009) {
      const aplicado = await aplicarPagamentoDividaAnterior(supabase, {
        empresaId: profile.empresa_id,
        pontoId,
        pontoNome: ponto.nome,
        valor: recebimentoRateado.aplicadoDividaAnterior,
        pixRestante,
        dinheiroRestante,
        formaPagamento: recebimento.data.forma,
        operadorId: user?.id ?? null,
        excluirVisitaPontoId: visitaPontoId ?? undefined,
      });
      haverGerado = Math.round(
        Math.max(0, recebimentoRateado.aplicadoDividaAnterior - aplicado) * 100
      ) / 100;
    }

    if (recebimentoRateado.haver > 0.009) {
      haverGerado = Math.round((haverGerado + recebimentoRateado.haver) * 100) / 100;
    }

    if (haverGerado > 0.009) {
      await registrarHaverFuraFura(supabase, {
        empresaId: profile.empresa_id,
        pontoId,
        pontoNome: ponto.nome,
        coletaId: coleta.id,
        valor: haverGerado,
        valorPix: pixRestante.v,
        valorDinheiro: dinheiroRestante.v,
        motivo: `Pagamento a maior (a receber R$ ${calculo.valorAReceber.toFixed(2).replace(".", ",")}, pago R$ ${recebimento.data.total.toFixed(2).replace(".", ",")})`,
        operadorId: user?.id ?? null,
        registrarFinanceiro: false,
      });
    }

    if (haverAbatido > 0.009) {
      await baixarHaverNicho(supabase, {
        empresaId: profile.empresa_id,
        pontoId,
        tituloKeyword: "fura-fura",
        valor: haverAbatido,
        coletaId: coleta.id,
      });
    }
  }

  if (visitaPontoId) {
    await vincularItemVisitaPonto({
      supabase,
      empresaId: profile.empresa_id,
      visitaPontoId,
      nicho: "fura_fura",
      coletaIds: [coleta.id],
    });
  }

  const { marcarParadasConcluidasPorPonto } = await import(
    "@/lib/rotas/marcar-paradas-concluidas"
  );
  await marcarParadasConcluidasPorPonto(supabase, profile.empresa_id!, pontoId);

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "coleta.criar",
    tabela: "coletas",
    registroId: coleta.id,
    dadosNovos: {
      ponto_id: pontoId,
      valor_a_receber: calculo.valorAReceber,
      ponto_nome: ponto.nome,
    },
    severidade: "low",
    categoria: "coleta",
    modulo: "coletas",
    titulo: `Coleta fura-fura · ${ponto.nome}`,
    resumo: `A receber R$ ${Number(calculo.valorAReceber).toFixed(2)}`,
    request,
  });

  const { pushColetaRegistrada } = await import("@/lib/push/events");
  pushColetaRegistrada({
    empresaId: profile.empresa_id!,
    autorUserId: profile.user_id,
    autorNome: profile.nome,
    pontoNome: ponto.nome,
    nichoLabel: "Fura-Fura",
    valor: Number(calculo.valorAReceber) || 0,
    url: "/coletas",
  });

  return NextResponse.json({
    success: true,
    id: coleta.id,
    calculo: {
      ...calculo,
      valorPagoRecebido: cobrandoAgora ? recebimentoRateado.aplicadoColetaAtual : 0,
      saldoPendente: cobrandoAgora
        ? recebimentoRateado.saldoPendenteColeta
        : roundPend(calculo.valorAReceber),
      haver: cobrandoAgora ? haverGerado : 0,
      quitado: cobrandoAgora ? recebimentoRateado.quitadoColeta : false,
    },
    haver: cobrandoAgora ? haverGerado : 0,
    dividaQuitada: cobrandoAgora ? recebimentoRateado.aplicadoDividaAnterior : 0,
    ponto: { nome: ponto.nome, whatsapp: ponto.whatsapp },
    modo_visita_ponto: modoVisitaPonto,
  });
}

function roundPend(n: number) {
  return Math.round(Math.max(0, n) * 100) / 100;
}
