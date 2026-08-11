import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";
import {
  calcularRecebimentoComPendencia,
  parseRecebimentoPixDinheiro,
  splitExcedentePagamento,
} from "@/lib/nichos/fura-fura";
import {
  calcularColetaConsignado,
  NICHO_MODULO_CONSIGNADO,
  ratearValorProporcional,
  type LinhaConsignadoInput,
  type ModoComissaoConsignado,
} from "@/lib/nichos/consignado";
import { registrarHaverConsignado } from "@/lib/nichos/consignado/haver-ponto";
import { baixarHaverNicho, somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import { parseVisitaPontoId, vincularItemVisitaPonto } from "@/lib/visitas-ponto/vincular-item";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";
import { aplicarPagamentoDividaAnterior } from "@/lib/visitas-ponto/checkout";
import { totalDividaAnteriorPonto } from "@/lib/visitas-ponto/divida-ponto";

type LinhaBody = { produto_id?: unknown; sobrou?: unknown; reposto?: unknown };
type ExpositorBody = { equipamento_id?: unknown; foto_url?: unknown; linhas?: LinhaBody[] };

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const visitaPontoId = parseVisitaPontoId(body.visita_ponto_id);
  const receberAgora = Boolean(body.receber_agora);
  const modoVisitaPonto = Boolean(visitaPontoId);
  const cobrandoAgora = !modoVisitaPonto || receberAgora;
  const descontarHaverNaCobranca = body.descontar_haver_na_cobranca === true;
  // body.incluir_pendencia_operacao: só afeta o total sugerido na UI

  const pontoId = String(body.ponto_id ?? "").trim();
  if (!pontoId) {
    return NextResponse.json({ error: "Selecione um comércio." }, { status: 400 });
  }

  const expositoresBody: ExpositorBody[] = Array.isArray(body.expositores) ? body.expositores : [];
  if (expositoresBody.length === 0) {
    return NextResponse.json({ error: "Nenhum expositor informado no recolhe." }, { status: 400 });
  }

  const recebimento = cobrandoAgora
    ? parseRecebimentoPixDinheiro(body)
    : { ok: true as const, data: { pix: 0, dinheiro: 0, total: 0, forma: "dinheiro" as const } };
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, nome, comissao_percentual, comissao_por_nicho, consignado_modo_comissao")
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!ponto) {
    return NextResponse.json({ error: "Comércio não encontrado." }, { status: 404 });
  }

  const modoBody = String(body.modo_comissao ?? "").trim();
  // Consignado é preço tabelado (custo / valor final / repasse do produto).
  // Só usa % se o body pedir explicitamente "percentual".
  const modoComissao: ModoComissaoConsignado =
    modoBody === "percentual" ? "percentual" : "tabela";

  const comissaoPercentual =
    modoComissao === "percentual"
      ? body.comissao_percentual != null && body.comissao_percentual !== ""
        ? Math.max(0, Number(body.comissao_percentual) || 0)
        : getComissaoPercentualNicho(ponto, "consignado")
      : 0;

  const equipamentosIds = expositoresBody
    .map((item) => String(item.equipamento_id ?? "").trim())
    .filter(Boolean);

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, nome, tipo, estoque_brindes")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", pontoId)
    .in("id", equipamentosIds);

  const equipamentosMap = new Map((equipamentos ?? []).map((eq) => [eq.id, eq]));

  const { data: produtos } = await supabase
    .from("produtos_consignados")
    .select("id, codigo, nome, custo_unitario, preco_venda, comissao_fixa, quantidade")
    .eq("empresa_id", profile.empresa_id);
  const produtosMap = new Map((produtos ?? []).map((p) => [p.id, p]));

  try {
    // Um cálculo por expositor
    const porExpositor = expositoresBody.map((exp) => {
      const equipamentoId = String(exp.equipamento_id ?? "").trim();
      const equipamento = equipamentosMap.get(equipamentoId);
      if (!equipamento) throw new Error("Expositor inválido no recolhe.");
      if (equipamento.tipo !== "consignado") {
        throw new Error(`${equipamento.nome} não é um expositor consignado.`);
      }

      const estoque = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
      const estoqueMap = new Map(estoque.map((e) => [e.item_id ?? e.nome, e]));

      const linhasInput: LinhaConsignadoInput[] = (exp.linhas ?? []).map((linha) => {
        const produtoId = String(linha.produto_id ?? "").trim();
        const estoqueItem = estoqueMap.get(produtoId);
        if (!estoqueItem) {
          throw new Error(`Produto fora do expositor ${equipamento.nome}.`);
        }
        const produto = produtosMap.get(produtoId);
        const deixado = Math.max(0, Math.floor(Number(estoqueItem.quantidade) || 0));
        const sobrou = Math.max(0, Math.floor(Number(linha.sobrou) || 0));
        const reposto = Math.max(0, Math.floor(Number(linha.reposto) || 0));
        return {
          produtoId,
          codigo: produto?.codigo ?? null,
          nome: estoqueItem.nome,
          deixado,
          sobrou,
          reposto,
          custoUnitario: Number(produto?.custo_unitario ?? estoqueItem.custo_unitario ?? 0),
          precoVenda: Number(produto?.preco_venda ?? 0),
          comissaoFixa: produto?.comissao_fixa ?? null,
        };
      });

      const calculo = calcularColetaConsignado({
        linhas: linhasInput,
        modoComissao,
        comissaoPercentual,
      });

      return {
        equipamentoId,
        nome: equipamento.nome,
        fotoUrl: String(exp.foto_url ?? "").trim() || null,
        estoque,
        calculo,
      };
    });

    const valorAReceberTotal =
      Math.round(porExpositor.reduce((acc, e) => acc + e.calculo.valorAReceber, 0) * 100) / 100;
    const valorBrutoTotal =
      Math.round(porExpositor.reduce((acc, e) => acc + e.calculo.valorBruto, 0) * 100) / 100;
    const valorComissaoTotal =
      Math.round(porExpositor.reduce((acc, e) => acc + e.calculo.valorComissao, 0) * 100) / 100;
    const custoTotal =
      Math.round(porExpositor.reduce((acc, e) => acc + e.calculo.custoProdutos, 0) * 100) / 100;
    const lucroTotal =
      Math.round(porExpositor.reduce((acc, e) => acc + e.calculo.lucroReal, 0) * 100) / 100;

    // Dívida universal do ponto (visita consolidada + demais cobráveis) — mesmo total em todo nicho.
    const pendenciaAnterior = cobrandoAgora
      ? await totalDividaAnteriorPonto(supabase, profile.empresa_id, pontoId)
      : 0;

    let haverAbatido = 0;
    if (cobrandoAgora && descontarHaverNaCobranca) {
      const { data: havers } = await supabase
        .from("pendencias")
        .select("tipo, titulo, valor")
        .eq("empresa_id", profile.empresa_id)
        .eq("ponto_id", pontoId)
        .eq("status", "aberta")
        .ilike("tipo", "haver");
      const haverSaldo = somarHaverNichoAberto(havers ?? [], "consignado");
      haverAbatido = Math.min(haverSaldo, valorAReceberTotal);
    }

    const valorCobrancaAtual = Math.max(0, valorAReceberTotal - haverAbatido);

    const recebimentoRateado = calcularRecebimentoComPendencia(
      valorCobrancaAtual,
      recebimento.data.total,
      pendenciaAnterior
    );

    const pagosPorExpositor = ratearValorProporcional(
      porExpositor.map((e) => e.calculo.valorAReceber),
      recebimentoRateado.aplicadoColetaAtual
    );

    const pixRestante = { v: recebimento.data.pix };
    const dinheiroRestante = { v: recebimento.data.dinheiro };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let primeiraColetaId: string | null = null;
    const coletasCriadasIds: string[] = [];

    for (let index = 0; index < porExpositor.length; index++) {
      const exp = porExpositor[index];
      const c = exp.calculo;
      const valorPago = pagosPorExpositor[index] ?? 0;
      const pagamento = splitExcedentePagamento(valorPago, pixRestante, dinheiroRestante);

      const brindesVendidos = c.linhas
        .filter((l) => l.vendido > 0)
        .map((l) => ({
          item_id: l.produtoId,
          codigo: l.codigo,
          nome: l.nome,
          quantidade: l.vendido,
          custo_unitario: l.custoUnitario,
          preco_venda: l.precoVenda,
          receita: l.receita,
          comissao: l.comissao,
        }));

      const { data: coleta, error: coletaError } = await supabase
        .from("coletas")
        .insert({
          empresa_id: profile.empresa_id,
          ponto_id: pontoId,
          equipamento_id: exp.equipamentoId,
          operador_id: user?.id ?? null,
          nicho_modulo: NICHO_MODULO_CONSIGNADO,
          valor_bruto: c.valorBruto,
          comissao_percentual: comissaoPercentual,
          valor_comissao: c.valorComissao,
          desconto: c.desconto,
          valor_a_receber: c.valorAReceber,
          valor_liquido: c.lucroReal,
          valor_pago_ponto: c.valorComissao,
          valor_pago_recebido:
            index === 0 ? Math.round((valorPago + haverAbatido) * 100) / 100 : valorPago,
          valor_pix: pagamento.pix,
          valor_dinheiro: pagamento.dinheiro,
          entrada_periodo: c.totalVendido,
          quantidade_furos: c.totalVendido,
          foto_url: exp.fotoUrl,
          observacao: body.observacao ? String(body.observacao) : null,
          forma_pagamento: recebimento.data.forma,
          custo_brindes: c.custoProdutos,
          lucro_real: c.lucroReal,
          brindes_entregues: brindesVendidos,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
        })
        .select("id")
        .single();

      if (coletaError || !coleta) {
        return NextResponse.json(
          { error: coletaError?.message ?? "Erro ao registrar recolhe consignado." },
          { status: 500 }
        );
      }

      if (!primeiraColetaId) primeiraColetaId = coleta.id;
      coletasCriadasIds.push(coleta.id);

      // Novo saldo no expositor = sobrou + reposto por produto
      const novoEstoque = exp.estoque.map((item) => {
        const linha = c.linhas.find((l) => (l.produtoId ?? l.nome) === (item.item_id ?? item.nome));
        return linha ? { ...item, quantidade: linha.novoSaldo } : item;
      });

      await supabase
        .from("equipamentos")
        .update({ estoque_brindes: novoEstoque, foto_url: exp.fotoUrl })
        .eq("id", exp.equipamentoId)
        .eq("empresa_id", profile.empresa_id);

      // Baixa a reposição do estoque central de produtos
      for (const linha of c.linhas) {
        if (linha.reposto > 0 && linha.produtoId) {
          const produto = produtosMap.get(linha.produtoId);
          const atual = Math.max(0, Math.floor(Number(produto?.quantidade) || 0));
          await supabase
            .from("produtos_consignados")
            .update({ quantidade: Math.max(0, atual - linha.reposto) })
            .eq("id", linha.produtoId)
            .eq("empresa_id", profile.empresa_id);
        }
      }

      if (valorPago > 0.009 && cobrandoAgora) {
        const pagamentoDetalhe = formatPagamentoDetalhe(pagamento.pix, pagamento.dinheiro);
        await supabase.from("coleta_pagamentos").insert({
          empresa_id: profile.empresa_id,
          coleta_id: coleta.id,
          ponto_id: pontoId,
          valor: valorPago,
          valor_pix: pagamento.pix,
          valor_dinheiro: pagamento.dinheiro,
          forma_pagamento: recebimento.data.forma,
          observacao: modoVisitaPonto ? "Pagamento no recolhe (receber na visita)" : "Pagamento no recolhe",
          operador_id: user?.id ?? null,
        });

        await supabase.from("financeiro").insert({
          empresa_id: profile.empresa_id,
          tipo: "entrada",
          categoria: "Coleta Consignado",
          valor: valorPago,
          descricao: pagamentoDetalhe
            ? `Consignado - ${ponto.nome} - ${exp.nome} — ${pagamentoDetalhe}`
            : `Consignado - ${ponto.nome} - ${exp.nome}`,
          forma_pagamento: recebimento.data.forma,
          ponto_id: pontoId,
          coleta_id: coleta.id,
          operador_id: user?.id ?? null,
        });
      }
    }

    if (!modoVisitaPonto && recebimentoRateado.saldoPendenteColeta > 0.009 && primeiraColetaId) {
      await supabase.from("pendencias").insert({
        empresa_id: profile.empresa_id,
        ponto_id: pontoId,
        coleta_id: primeiraColetaId,
        tipo: recebimentoRateado.aplicadoColetaAtual > 0.009 ? "parcial" : "pagamento_pendente",
        titulo: "Recolhe Consignado pendente",
        descricao: `Saldo do recolhe de ${new Date().toLocaleDateString("pt-BR")} — ${ponto.nome}`,
        valor: recebimentoRateado.saldoPendenteColeta,
        prioridade: "media",
        status: "aberta",
      });
    }

    let haverGerado = 0;

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
        await registrarHaverConsignado(supabase, {
          empresaId: profile.empresa_id,
          pontoId,
          pontoNome: ponto.nome,
          coletaId: primeiraColetaId,
          valor: haverGerado,
          valorPix: pixRestante.v,
          valorDinheiro: dinheiroRestante.v,
          motivo: `Pagamento a maior (a receber R$ ${valorAReceberTotal
            .toFixed(2)
            .replace(".", ",")}, pago R$ ${recebimento.data.total.toFixed(2).replace(".", ",")})`,
          operadorId: user?.id ?? null,
          registrarFinanceiro: false,
        });
      }

      if (haverAbatido > 0.009) {
        await baixarHaverNicho(supabase, {
          empresaId: profile.empresa_id,
          pontoId,
          tituloKeyword: "consignado",
          valor: haverAbatido,
          coletaId: primeiraColetaId ?? undefined,
        });
      }
    }

    await supabase
      .from("pontos")
      .update({ ultima_coleta: new Date().toISOString() })
      .eq("id", pontoId)
      .eq("empresa_id", profile.empresa_id);

    if (visitaPontoId && coletasCriadasIds.length > 0) {
      await vincularItemVisitaPonto({
        supabase,
        empresaId: profile.empresa_id,
        visitaPontoId,
        nicho: "consignado",
        coletaIds: coletasCriadasIds,
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
      registroId: coletasCriadasIds[0] ?? null,
      dadosNovos: {
        coleta_ids: coletasCriadasIds,
        ponto_id: pontoId,
        valor_a_receber: valorAReceberTotal,
        lucro_real: lucroTotal,
      },
      severidade: "low",
      categoria: "coleta",
      modulo: "coletas",
      titulo: `Recolhe consignado · ${porExpositor.length} expositor(es)`,
      resumo: `A receber R$ ${Number(valorAReceberTotal).toFixed(2)} · lucro R$ ${Number(lucroTotal).toFixed(2)}`,
      request,
    });

    const { pushColetaRegistrada } = await import("@/lib/push/events");
    pushColetaRegistrada({
      empresaId: profile.empresa_id!,
      autorUserId: profile.user_id,
      autorNome: profile.nome,
      pontoNome: ponto.nome,
      nichoLabel: "Consignado",
      valor: Number(valorAReceberTotal) || 0,
    });

    return NextResponse.json({
      success: true,
      coleta_ids: coletasCriadasIds,
      haver: cobrandoAgora ? haverGerado : 0,
      dividaQuitada: cobrandoAgora ? recebimentoRateado.aplicadoDividaAnterior : 0,
      resumo: {
        expositores: porExpositor.length,
        valor_bruto: valorBrutoTotal,
        comissao: valorComissaoTotal,
        valor_a_receber: valorAReceberTotal,
        valor_pago: recebimentoRateado.aplicadoColetaAtual,
        saldo_pendente: recebimentoRateado.saldoPendenteColeta,
        custo_brindes: custoTotal,
        lucro_real: lucroTotal,
        haver: cobrandoAgora ? haverGerado : 0,
      },
      modo_visita_ponto: modoVisitaPonto,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no recolhe consignado." },
      { status: 400 }
    );
  }
}
