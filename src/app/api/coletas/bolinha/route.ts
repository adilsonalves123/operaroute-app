import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";
import {
  calcularRecebimentoComPendencia,
  parseRecebimentoPixDinheiro,
  splitExcedentePagamento,
} from "@/lib/nichos/fura-fura";
import {
  calcularColetaBolinha,
  NICHO_MODULO_BOLINHA,
  ratearValorProporcional,
} from "@/lib/nichos/bolinha";
import { registrarHaverBolinha } from "@/lib/nichos/bolinha/haver-ponto";
import { baixarHaverNicho, somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import {
  deduzirEstoquePonto,
  normalizarEstoqueBrindesPonto,
  validarBrindesContraEstoquePonto,
} from "@/lib/estoque/brindes-ponto";
import { parseVisitaPontoId, vincularItemVisitaPonto } from "@/lib/visitas-ponto/vincular-item";
import { aplicarPagamentoDividaAnterior } from "@/lib/visitas-ponto/checkout";
import { totalDividaAnteriorPonto } from "@/lib/visitas-ponto/divida-ponto";

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
    return NextResponse.json({ error: "Selecione um ponto." }, { status: 400 });
  }

  if (!Array.isArray(body.leituras) || body.leituras.length === 0) {
    return NextResponse.json({ error: "Nenhuma máquina informada na coleta." }, { status: 400 });
  }

  const recebimento = cobrandoAgora
    ? parseRecebimentoPixDinheiro(body)
    : { ok: true as const, data: { pix: 0, dinheiro: 0, total: 0, forma: "dinheiro" as const } };
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const comissaoPercentual = Math.max(0, Number(body.comissao_percentual) || 0);
  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  const equipamentosIds = body.leituras
    .map((item: { equipamento_id?: unknown }) => String(item.equipamento_id ?? "").trim())
    .filter(Boolean);

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, nome, numero_serie, entrada_atual, tipo, estoque_brindes, preco_jogada")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", pontoId)
    .in("id", equipamentosIds);

  const equipamentosMap = new Map((equipamentos ?? []).map((eq) => [eq.id, eq]));

  try {
    const calculo = calcularColetaBolinha({
      comissaoPercentual,
      desconto: Number(body.desconto) || 0,
      valorPagoRecebido: cobrandoAgora ? recebimento.data.total : 0,
      leituras: body.leituras.map(
        (item: {
          equipamento_id?: unknown;
          valor_contado?: unknown;
          preco_jogada?: unknown;
          entrada_anterior?: unknown;
          foto_url?: unknown;
        }) => {
          const equipamentoId = String(item.equipamento_id ?? "").trim();
          const equipamento = equipamentosMap.get(equipamentoId);
          if (!equipamento) {
            throw new Error("Equipamento inválido na coleta.");
          }
          if (equipamento.tipo !== "bolinha") {
            throw new Error(`O equipamento ${equipamento.nome} não é do nicho bolinha.`);
          }
          if (!equipamento.numero_serie?.trim()) {
            throw new Error(`A máquina ${equipamento.nome} está sem número de série.`);
          }
          if (!String(item.foto_url ?? "").trim()) {
            throw new Error(`A foto da máquina ${equipamento.nome} é obrigatória.`);
          }

          const precoJogada = Number(equipamento.preco_jogada ?? item.preco_jogada ?? 0);
          if (!(precoJogada > 0)) {
            throw new Error(
              `Cadastre o valor da jogada em ${equipamento.nome} antes de coletar.`
            );
          }

          const valorContado = Number(item.valor_contado);
          if (!Number.isFinite(valorContado) || valorContado < 0) {
            throw new Error(`Informe o dinheiro contado de ${equipamento.nome}.`);
          }

          return {
            equipamentoId,
            nome: equipamento.nome,
            valorContado,
            precoJogada,
            entradaAnteriorCentavos: Number(
              item.entrada_anterior ?? equipamento.entrada_atual ?? 0
            ),
            fotoUrl: String(item.foto_url ?? "").trim(),
            estoqueMaquina: normalizarEstoqueBrindesPonto(equipamento.estoque_brindes),
          };
        }
      ),
    });

    for (const maquina of calculo.maquinas) {
      const equipamento = equipamentosMap.get(maquina.equipamentoId);
      if (!equipamento) {
        return NextResponse.json({ error: "Equipamento inválido na coleta." }, { status: 400 });
      }
      const estoqueMaquina = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
      const erroEstoque = validarBrindesContraEstoquePonto(maquina.brindes, estoqueMaquina);
      if (erroEstoque) {
        return NextResponse.json(
          { error: `${equipamento.nome}: ${erroEstoque}` },
          { status: 400 }
        );
      }
    }

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
      const haverSaldo = somarHaverNichoAberto(havers ?? [], "bolinha");
      haverAbatido = Math.min(haverSaldo, calculo.valorAReceber);
    }

    const valorCobrancaAtual = Math.max(0, calculo.valorAReceber - haverAbatido);

    const recebimentoRateado = calcularRecebimentoComPendencia(
      valorCobrancaAtual,
      recebimento.data.total,
      pendenciaAnterior
    );

    const pagosPorMaquina = ratearValorProporcional(
      calculo.maquinas.map((maquina) => maquina.valorAReceber),
      recebimentoRateado.aplicadoColetaAtual
    );

    const pixRestante = { v: recebimento.data.pix };
    const dinheiroRestante = { v: recebimento.data.dinheiro };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let primeiraColetaId: string | null = null;
    const coletasCriadasIds: string[] = [];

    for (let index = 0; index < calculo.maquinas.length; index++) {
      const maquina = calculo.maquinas[index];
      const valorPagoMaquina = pagosPorMaquina[index] ?? 0;
      const pagamentoMaquina = splitExcedentePagamento(valorPagoMaquina, pixRestante, dinheiroRestante);

      const { data: coleta, error: coletaError } = await supabase
        .from("coletas")
        .insert({
          empresa_id: profile.empresa_id,
          ponto_id: pontoId,
          equipamento_id: maquina.equipamentoId,
          operador_id: user?.id ?? null,
          nicho_modulo: NICHO_MODULO_BOLINHA,
          valor_bruto: maquina.valorBruto,
          comissao_percentual: comissaoPercentual,
          valor_comissao: maquina.valorComissao,
          desconto: maquina.desconto,
          valor_a_receber: maquina.valorAReceber,
          valor_liquido: maquina.lucroReal,
          valor_pago_ponto: maquina.valorComissao,
          valor_pago_recebido:
            index === 0
              ? Math.round((valorPagoMaquina + haverAbatido) * 100) / 100
              : valorPagoMaquina,
          valor_pix: pagamentoMaquina.pix,
          valor_dinheiro: pagamentoMaquina.dinheiro,
          entrada_anterior: maquina.entradaAnterior,
          entrada_atual: maquina.entradaAtual,
          entrada_periodo: maquina.entradaPeriodo,
          quantidade_furos: maquina.unidadesSaiu,
          foto_url: maquina.fotoUrl ?? null,
          observacao: body.observacao ? String(body.observacao) : null,
          forma_pagamento: recebimento.data.forma,
          custo_brindes: maquina.custoBrindes,
          lucro_real: maquina.lucroReal,
          brindes_entregues: maquina.brindes,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          divida_quitada:
            cobrandoAgora && index === 0 ? recebimentoRateado.aplicadoDividaAnterior : 0,
        })
        .select("id")
        .single();

      if (coletaError || !coleta) {
        return NextResponse.json(
          { error: coletaError?.message ?? "Erro ao registrar coleta de Bolinha." },
          { status: 500 }
        );
      }

      if (!primeiraColetaId) primeiraColetaId = coleta.id;
      coletasCriadasIds.push(coleta.id);

      await supabase
        .from("equipamentos")
        .update({
          entrada_atual: maquina.entradaAtual,
          foto_url: maquina.fotoUrl ?? null,
        })
        .eq("id", maquina.equipamentoId)
        .eq("empresa_id", profile.empresa_id);

      if (valorPagoMaquina > 0.009 && cobrandoAgora) {
        const pagamentoDetalhe = formatPagamentoDetalhe(
          pagamentoMaquina.pix,
          pagamentoMaquina.dinheiro
        );

        await supabase.from("coleta_pagamentos").insert({
          empresa_id: profile.empresa_id,
          coleta_id: coleta.id,
          ponto_id: pontoId,
          valor: valorPagoMaquina,
          valor_pix: pagamentoMaquina.pix,
          valor_dinheiro: pagamentoMaquina.dinheiro,
          forma_pagamento: recebimento.data.forma,
          observacao: modoVisitaPonto ? "Pagamento na coleta (receber na visita)" : "Pagamento na coleta",
          operador_id: user?.id ?? null,
        });

        await supabase.from("financeiro").insert({
          empresa_id: profile.empresa_id,
          tipo: "entrada",
          categoria: "Coleta Bolinha",
          valor: valorPagoMaquina,
          descricao: pagamentoDetalhe
            ? `Coleta Bolinha - ${ponto.nome} - ${maquina.nome} — ${pagamentoDetalhe}`
            : `Coleta Bolinha - ${ponto.nome} - ${maquina.nome}`,
          forma_pagamento: recebimento.data.forma,
          ponto_id: pontoId,
          coleta_id: coleta.id,
          operador_id: user?.id ?? null,
        });
      }
    }

    if (!modoVisitaPonto && recebimentoRateado.saldoPendenteColeta > 0.009 && primeiraColetaId) {
      const { data: pendNova } = await supabase
        .from("pendencias")
        .insert({
          empresa_id: profile.empresa_id,
          ponto_id: pontoId,
          coleta_id: primeiraColetaId,
          tipo: recebimentoRateado.aplicadoColetaAtual > 0.009 ? "parcial" : "pagamento_pendente",
          titulo: "Coleta Bolinha pendente",
          descricao: `Saldo da coleta de ${new Date().toLocaleDateString("pt-BR")} — ${ponto.nome}`,
          valor: recebimentoRateado.saldoPendenteColeta,
          prioridade: "media",
          status: "aberta",
        })
        .select("id, tipo, titulo, valor")
        .maybeSingle();
      if (pendNova) {
        const { pushPendenciaCriada } = await import("@/lib/push/events");
        pushPendenciaCriada({
          empresaId: profile.empresa_id!,
          autorUserId: profile.user_id,
          autorNome: profile.nome,
          pontoNome: ponto.nome,
          pendenciaId: pendNova.id,
          tipo: pendNova.tipo,
          titulo: pendNova.titulo,
          valor: Number(pendNova.valor) || 0,
        });
      }
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
          origemColetaId: primeiraColetaId ?? undefined,
        });

        haverGerado = Math.round(
          Math.max(0, recebimentoRateado.aplicadoDividaAnterior - aplicado) * 100
        ) / 100;
      }

      if (recebimentoRateado.haver > 0.009) {
        haverGerado = Math.round((haverGerado + recebimentoRateado.haver) * 100) / 100;
      }

      if (haverGerado > 0.009) {
        await registrarHaverBolinha(supabase, {
          empresaId: profile.empresa_id,
          pontoId,
          pontoNome: ponto.nome,
          coletaId: primeiraColetaId,
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
          tituloKeyword: "bolinha",
          valor: haverAbatido,
          coletaId: primeiraColetaId ?? undefined,
        });
      }
    }

    await supabase
      .from("pontos")
      .update({
        ultima_coleta: new Date().toISOString(),
      })
      .eq("id", pontoId)
      .eq("empresa_id", profile.empresa_id);

    for (const maquina of calculo.maquinas) {
      const equipamento = equipamentosMap.get(maquina.equipamentoId);
      if (!equipamento || maquina.brindes.length === 0) continue;

      const estoqueMaquina = normalizarEstoqueBrindesPonto(equipamento.estoque_brindes);
      const novoEstoque = deduzirEstoquePonto(estoqueMaquina, maquina.brindes);

      await supabase
        .from("equipamentos")
        .update({ estoque_brindes: novoEstoque })
        .eq("id", maquina.equipamentoId)
        .eq("empresa_id", profile.empresa_id);
    }

    if (visitaPontoId && coletasCriadasIds.length > 0) {
      const religarFinalizada =
        body.religar_visita_finalizada === true || body.editar_visita_finalizada === true;
      await vincularItemVisitaPonto({
        supabase,
        empresaId: profile.empresa_id,
        visitaPontoId,
        nicho: "bolinha",
        coletaIds: coletasCriadasIds,
        permitirReligarFinalizada: religarFinalizada,
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
        valor_a_receber: calculo.valorAReceber,
        valor_pago: recebimentoRateado.aplicadoColetaAtual,
        saldo_pendente: recebimentoRateado.saldoPendenteColeta,
        lucro_real: calculo.lucroReal,
      },
      severidade: recebimentoRateado.saldoPendenteColeta > 0.02 ? "medium" : "low",
      categoria: "coleta",
      modulo: "coletas",
      titulo: `Coleta bolinha · ${calculo.maquinas.length} máquina(s)`,
      resumo: `A receber R$ ${Number(calculo.valorAReceber).toFixed(2)} · pago R$ ${Number(recebimentoRateado.aplicadoColetaAtual).toFixed(2)}`,
      request,
    });

    const { pushColetaSalva, bodyEditandoColeta } = await import("@/lib/push/events");
    pushColetaSalva({
      empresaId: profile.empresa_id!,
      autorUserId: profile.user_id,
      autorNome: profile.nome,
      pontoNome: ponto.nome,
      nichoLabel: "Bolinha",
      valor: Number(calculo.valorAReceber) || 0,
      coletaId: coletasCriadasIds[0],
      editando: bodyEditandoColeta(body as Record<string, unknown>),
    });

    return NextResponse.json({
      success: true,
      coleta_ids: coletasCriadasIds,
      haver: cobrandoAgora ? haverGerado : 0,
      dividaQuitada: cobrandoAgora ? recebimentoRateado.aplicadoDividaAnterior : 0,
      resumo: {
        maquinas: calculo.maquinas.length,
        valor_bruto: calculo.valorBruto,
        comissao: calculo.valorComissao,
        desconto: calculo.desconto,
        valor_a_receber: calculo.valorAReceber,
        valor_pago: recebimentoRateado.aplicadoColetaAtual,
        saldo_pendente: recebimentoRateado.saldoPendenteColeta,
        custo_brindes: calculo.custoBrindes,
        lucro_real: calculo.lucroReal,
        haver: cobrandoAgora ? haverGerado : 0,
      },
      modo_visita_ponto: modoVisitaPonto,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro na coleta de Bolinha." },
      { status: 400 }
    );
  }
}
