import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPagamentoDetalhe, deriveFormaPagamento } from "@/lib/financeiro/forma-pagamento";
import { aplicarPagamentoFifoColetas, saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import { ratearValorProporcional } from "@/lib/nichos/ursinho";
import { splitExcedentePagamento } from "@/lib/nichos/fura-fura/haver-ponto";
import { registrarHaverFuraFura } from "@/lib/nichos/fura-fura";
import { fetchVisitaPontoResumo, cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import {
  fetchCassinoVisitaIdsVisitaPonto,
  listarPendenciasCobraveisPonto,
  totalDividaAnteriorPonto,
} from "@/lib/visitas-ponto/divida-ponto";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import {
  reconciliarPendenciasCobraveisPonto,
  sincronizarPendenciaDaColeta,
} from "@/lib/visitas-ponto/reconciliar-pendencias-ponto";
import { baixarHaverPonto, fetchHaverSaldoPonto } from "@/lib/coletas/haver-nicho";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CheckoutCalculo = {
  subtotalCobravel: number;
  dividaAnteriorTotal: number;
  dividaRecebidaInicio: number;
  dividaSaldo: number;
  desconto: number;
  subtotalAposDesconto: number;
  haverSaldo: number;
  haverAbatido: number;
  totalACobrar: number;
  valorPago: number;
  restante: number;
  /** Haver gerado por pagamento a maior (não confundir com haverAbatido). */
  haver: number;
  aplicadoDivida: number;
  aplicadoVisita: number;
};

export function calcularCheckoutVisita(input: {
  subtotalCobravel: number;
  dividaAnteriorTotal: number;
  dividaRecebidaInicio: number;
  desconto: number;
  pix: number;
  dinheiro: number;
  /** Haver aberto do ponto disponível para abater. */
  haverSaldo?: number;
  /** Se true, abate haver do subtotal da visita (como no Receber do nicho). */
  descontarHaver?: boolean;
}): CheckoutCalculo {
  const dividaSaldo = round2(Math.max(0, input.dividaAnteriorTotal - input.dividaRecebidaInicio));
  const subtotalAposDesconto = round2(Math.max(0, input.subtotalCobravel - input.desconto));
  const haverSaldo = round2(Math.max(0, input.haverSaldo ?? 0));
  const haverAbatido =
    input.descontarHaver === true
      ? round2(Math.min(haverSaldo, subtotalAposDesconto))
      : 0;
  const subtotalLiquido = round2(Math.max(0, subtotalAposDesconto - haverAbatido));
  const totalACobrar = round2(dividaSaldo + subtotalLiquido);
  const valorPago = round2(Math.max(0, input.pix + input.dinheiro));

  // Dinheiro + haver abatido = crédito para quitar visita e (depois) dívida.
  const credito = round2(valorPago + haverAbatido);
  const aplicadoVisita = round2(Math.min(credito, subtotalAposDesconto));
  const aplicadoDivida = round2(Math.min(Math.max(0, credito - aplicadoVisita), dividaSaldo));
  const restante = round2(Math.max(0, totalACobrar - valorPago));
  const haver = round2(Math.max(0, valorPago - totalACobrar));

  return {
    subtotalCobravel: round2(input.subtotalCobravel),
    dividaAnteriorTotal: round2(input.dividaAnteriorTotal),
    dividaRecebidaInicio: round2(input.dividaRecebidaInicio),
    dividaSaldo,
    desconto: round2(input.desconto),
    subtotalAposDesconto,
    haverSaldo,
    haverAbatido,
    totalACobrar,
    valorPago,
    restante,
    haver,
    aplicadoDivida,
    aplicadoVisita,
  };
}

type ItemCobravel = {
  kind: "coleta" | "cassino_visita";
  id: string;
  valorCobravel: number;
  valorPago: number;
};

async function carregarItensCobraveis(
  supabase: SupabaseClient,
  empresaId: string,
  visitaPontoId: string
): Promise<ItemCobravel[]> {
  const { data: itens } = await supabase
    .from("visita_ponto_itens")
    .select("cassino_visita_id, coleta_id")
    .eq("visita_ponto_id", visitaPontoId)
    .eq("empresa_id", empresaId);

  const cassinoIds = [...new Set((itens ?? []).map((i) => i.cassino_visita_id).filter(Boolean))] as string[];
  const coletaIds = [...new Set((itens ?? []).map((i) => i.coleta_id).filter(Boolean))] as string[];

  const itensCobraveis: ItemCobravel[] = [];

  if (cassinoIds.length > 0) {
    const { data: visitas } = await supabase
      .from("visitas")
      .select("id, saldo_negativo, valor_operacao_efetivo, valor_pago, restante, debito_abatido")
      .in("id", cassinoIds)
      .eq("empresa_id", empresaId);

    for (const v of visitas ?? []) {
      if (v.saldo_negativo) continue;
      const saldo = cobravelCassinoVisita(v);
      if (saldo <= 0.009) continue;
      const pago = Number(v.valor_pago ?? 0);
      itensCobraveis.push({
        kind: "cassino_visita",
        id: v.id,
        valorCobravel: round2(pago + saldo),
        valorPago: pago,
      });
    }
  }

  if (coletaIds.length > 0) {
    const { data: coletas } = await supabase
      .from("coletas")
      .select("id, valor_a_receber, valor_pago_recebido")
      .in("id", coletaIds)
      .eq("empresa_id", empresaId);

    for (const c of coletas ?? []) {
      itensCobraveis.push({
        kind: "coleta",
        id: c.id,
        valorCobravel: Number(c.valor_a_receber ?? 0),
        valorPago: Number(c.valor_pago_recebido ?? 0),
      });
    }
  }

  return itensCobraveis.filter((i) => i.valorCobravel > 0.009);
}

export async function aplicarPagamentoDividaAnterior(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    pontoNome: string;
    valor: number;
    pixRestante: { v: number };
    dinheiroRestante: { v: number };
    formaPagamento: string;
    operadorId: string | null;
    excluirVisitaPontoId?: string;
    excluirVisitaIds?: string[];
  }
): Promise<number> {
  let restante = opts.valor;
  if (restante <= 0.009) return 0;

  const pendencias = await listarPendenciasCobraveisPonto(
    supabase,
    opts.empresaId,
    opts.pontoId,
    {
      excluirVisitaPontoId: opts.excluirVisitaPontoId,
      excluirVisitaIds: opts.excluirVisitaIds,
    }
  );

  for (const pend of pendencias) {
    if (restante <= 0.009) break;

    const saldo =
      pend.tipo === "negativo"
        ? saldoPendenciaReais({ id: pend.id, valor: pend.valor, observacao: pend.descricao })
        : Number(pend.valor ?? 0);

    if (saldo <= 0.009) continue;

    if (pend.coleta_id) {
      const { data: coleta } = await supabase
        .from("coletas")
        .select("id, created_at, valor_a_receber, valor_pago_recebido")
        .eq("id", pend.coleta_id)
        .maybeSingle();

      if (!coleta) continue;
      const saldoColeta = saldoPendenteColeta(coleta);
      const aplicar = round2(Math.min(restante, saldoColeta));
      if (aplicar <= 0.009) continue;

      await aplicarPagamentoFifoColetas(supabase, {
        empresaId: opts.empresaId,
        pontoId: opts.pontoId,
        pontoNome: opts.pontoNome,
        coletas: [
          {
            id: coleta.id,
            created_at: coleta.created_at,
            valor_a_receber: Number(coleta.valor_a_receber ?? 0),
            valor_pago_recebido: Number(coleta.valor_pago_recebido ?? 0),
          },
        ],
        valor: aplicar,
        pixRestante: opts.pixRestante,
        dinheiroRestante: opts.dinheiroRestante,
        formaPagamento: opts.formaPagamento,
        operadorId: opts.operadorId,
        observacao: "Quitação na visita ao ponto",
        categoriaFinanceiro: "Recebimento visita",
      });

      restante = round2(restante - aplicar);
      continue;
    }

    if (pend.visita_id) {
      const { data: visita } = await supabase
        .from("visitas")
        .select(
          "id, valor_operacao_efetivo, valor_pago, restante, debito_abatido, saldo_negativo"
        )
        .eq("id", pend.visita_id)
        .maybeSingle();

      if (!visita || visita.saldo_negativo) continue;
      const saldoVisita = cobravelCassinoVisita(visita);
      const aplicar = round2(Math.min(restante, saldoVisita, saldo));
      if (aplicar <= 0.009) continue;

      const novoPago = round2(Number(visita.valor_pago ?? 0) + aplicar);
      const novoRestante = round2(Math.max(0, saldoVisita - aplicar));
      await supabase
        .from("visitas")
        .update({
          valor_pago: novoPago,
          restante: novoRestante,
        })
        .eq("id", visita.id);

      const { pix, dinheiro } = splitExcedentePagamento(
        aplicar,
        opts.pixRestante,
        opts.dinheiroRestante
      );
      await supabase.from("financeiro").insert({
        empresa_id: opts.empresaId,
        tipo: "entrada",
        categoria: "Recebimento visita",
        valor: aplicar,
        descricao: `Quitação cassino — ${opts.pontoNome}`,
        forma_pagamento: deriveFormaPagamento(pix, dinheiro),
        ponto_id: opts.pontoId,
        visita_id: visita.id,
        operador_id: opts.operadorId,
      });

      const novoSaldoPend = round2(Math.max(0, saldo - aplicar));
      if (novoSaldoPend <= 0.009) {
        await supabase
          .from("pendencias")
          .update({ status: "resolvida", valor: 0, resolvido_em: new Date().toISOString() })
          .eq("id", pend.id);
      } else {
        await supabase.from("pendencias").update({ valor: novoSaldoPend }).eq("id", pend.id);
      }

      restante = round2(restante - aplicar);
      continue;
    }

    const aplicar = round2(Math.min(restante, saldo));
    if (aplicar <= 0.009) continue;

    const novoSaldo = round2(saldo - aplicar);
    await supabase
      .from("pendencias")
      .update({
        valor: novoSaldo,
        status: novoSaldo <= 0.009 ? "resolvida" : "aberta",
        resolvido_em: novoSaldo <= 0.009 ? new Date().toISOString() : null,
      })
      .eq("id", pend.id);

    const { pix, dinheiro } = splitExcedentePagamento(
      aplicar,
      opts.pixRestante,
      opts.dinheiroRestante
    );
    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria: "Recebimento visita",
      valor: aplicar,
      descricao: `Quitação — ${opts.pontoNome} — ${pend.titulo}`,
      forma_pagamento: deriveFormaPagamento(pix, dinheiro),
      ponto_id: opts.pontoId,
      operador_id: opts.operadorId,
    });

    restante = round2(restante - aplicar);
  }

  return round2(opts.valor - restante);
}

/** Credita pagamento nos itens sem registrar caixa (haver abatido). */
async function aplicarCreditoHaverItensVisita(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaPontoId: string;
    valor: number;
  }
) {
  const itens = await carregarItensCobraveis(supabase, opts.empresaId, opts.visitaPontoId);
  if (itens.length === 0 || opts.valor <= 0.009) return;

  const saldos = itens.map((i) => round2(Math.max(0, i.valorCobravel - i.valorPago)));
  const rateios = ratearValorProporcional(saldos, opts.valor);

  for (let idx = 0; idx < itens.length; idx++) {
    const item = itens[idx];
    const aplicar = rateios[idx] ?? 0;
    if (aplicar <= 0.009) continue;

    if (item.kind === "coleta") {
      const novoPago = round2(item.valorPago + aplicar);
      await supabase
        .from("coletas")
        .update({ valor_pago_recebido: novoPago })
        .eq("id", item.id);
      item.valorPago = novoPago;
      await sincronizarPendenciaDaColeta(supabase, {
        empresaId: opts.empresaId,
        coletaId: item.id,
      });
    } else {
      const novoPago = round2(item.valorPago + aplicar);
      const novoRestante = round2(Math.max(0, item.valorCobravel - novoPago));
      await supabase
        .from("visitas")
        .update({
          valor_pago: novoPago,
          restante: novoRestante,
        })
        .eq("id", item.id);
      item.valorPago = novoPago;

      const { data: pendOps } = await supabase
        .from("pendencias")
        .select("id, valor")
        .eq("empresa_id", opts.empresaId)
        .eq("visita_id", item.id)
        .eq("status", "aberta")
        .in("tipo", ["pagamento_pendente", "parcial"])
        .order("created_at", { ascending: true });

      for (const p of pendOps ?? []) {
        if (novoRestante <= 0.009) {
          await supabase
            .from("pendencias")
            .update({
              status: "resolvida",
              valor: 0,
              resolvido_em: new Date().toISOString(),
            })
            .eq("id", p.id);
        } else {
          await supabase
            .from("pendencias")
            .update({ valor: novoRestante })
            .eq("id", p.id);
        }
      }
    }
  }
}

async function absorverSaldosItensVisitaNaConsolidada(
  supabase: SupabaseClient,
  opts: { empresaId: string; visitaPontoId: string }
) {
  const itens = await carregarItensCobraveis(supabase, opts.empresaId, opts.visitaPontoId);
  const agora = new Date().toISOString();

  for (const item of itens) {
    const saldo = round2(Math.max(0, item.valorCobravel - item.valorPago));
    if (saldo <= 0.009) continue;

    if (item.kind === "coleta") {
      // Dívida da visita migrou para pendência universal do ponto — zera saldo da coleta.
      await supabase
        .from("coletas")
        .update({ valor_pago_recebido: item.valorCobravel })
        .eq("id", item.id)
        .eq("empresa_id", opts.empresaId);

      await sincronizarPendenciaDaColeta(supabase, {
        empresaId: opts.empresaId,
        coletaId: item.id,
      });
    } else {
      await supabase
        .from("visitas")
        .update({
          valor_pago: item.valorCobravel,
          restante: 0,
        })
        .eq("id", item.id)
        .eq("empresa_id", opts.empresaId);

      await supabase
        .from("pendencias")
        .update({
          valor: 0,
          status: "resolvida",
          resolvido_em: agora,
        })
        .eq("empresa_id", opts.empresaId)
        .eq("visita_id", item.id)
        .eq("status", "aberta")
        .in("tipo", ["pagamento_pendente", "parcial"]);
    }
  }
}

async function aplicarPagamentoItensVisita(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    pontoNome: string;
    visitaPontoId: string;
    valor: number;
    pixRestante: { v: number };
    dinheiroRestante: { v: number };
    formaPagamento: string;
    operadorId: string | null;
  }
) {
  const itens = await carregarItensCobraveis(supabase, opts.empresaId, opts.visitaPontoId);
  if (itens.length === 0 || opts.valor <= 0.009) return;

  const saldos = itens.map((i) => round2(Math.max(0, i.valorCobravel - i.valorPago)));
  const rateios = ratearValorProporcional(saldos, opts.valor);

  for (let idx = 0; idx < itens.length; idx++) {
    const item = itens[idx];
    const aplicar = rateios[idx] ?? 0;
    if (aplicar <= 0.009) continue;

    const { pix, dinheiro } = splitExcedentePagamento(
      aplicar,
      opts.pixRestante,
      opts.dinheiroRestante
    );

    if (item.kind === "coleta") {
      const novoPago = round2(item.valorPago + aplicar);
      await supabase
        .from("coletas")
        .update({
          valor_pago_recebido: novoPago,
          valor_pix: pix,
          valor_dinheiro: dinheiro,
          forma_pagamento: opts.formaPagamento,
        })
        .eq("id", item.id);

      await supabase.from("coleta_pagamentos").insert({
        empresa_id: opts.empresaId,
        coleta_id: item.id,
        ponto_id: opts.pontoId,
        valor: aplicar,
        valor_pix: pix,
        valor_dinheiro: dinheiro,
        forma_pagamento: opts.formaPagamento,
        observacao: "Pagamento na visita ao ponto",
        operador_id: opts.operadorId,
      });

      await sincronizarPendenciaDaColeta(supabase, {
        empresaId: opts.empresaId,
        coletaId: item.id,
      });
    } else {
      const novoPago = round2(item.valorPago + aplicar);
      const novoRestante = round2(Math.max(0, item.valorCobravel - novoPago));
      await supabase
        .from("visitas")
        .update({
          valor_pago: novoPago,
          valor_pix: pix,
          valor_dinheiro: dinheiro,
          restante: novoRestante,
          forma_pagamento: opts.formaPagamento,
        })
        .eq("id", item.id);

      // Mantém pagamento_pendente/parcial alinhado com o restante da visita.
      const { data: pendOps } = await supabase
        .from("pendencias")
        .select("id, valor")
        .eq("empresa_id", opts.empresaId)
        .eq("visita_id", item.id)
        .eq("status", "aberta")
        .in("tipo", ["pagamento_pendente", "parcial"])
        .order("created_at", { ascending: true });

      let abater = aplicar;
      for (const pend of pendOps ?? []) {
        if (abater <= 0.009) break;
        const saldoPend = Number(pend.valor ?? 0);
        const baixa = round2(Math.min(abater, saldoPend));
        const novoValor = round2(Math.max(0, saldoPend - baixa));
        await supabase
          .from("pendencias")
          .update({
            valor: novoValor,
            status: novoValor <= 0.009 ? "resolvida" : "aberta",
            resolvido_em: novoValor <= 0.009 ? new Date().toISOString() : null,
          })
          .eq("id", pend.id);
        abater = round2(abater - baixa);
      }
    }

    const detalhe = formatPagamentoDetalhe(pix, dinheiro);
    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria: "Visita ao ponto",
      valor: aplicar,
      descricao: detalhe
        ? `Visita — ${opts.pontoNome} — ${detalhe}`
        : `Visita — ${opts.pontoNome}`,
      forma_pagamento: opts.formaPagamento,
      ponto_id: opts.pontoId,
      operador_id: opts.operadorId,
    });
  }
}

export async function aplicarRecebimentoDividaInicio(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaPontoId: string;
    pontoId: string;
    pontoNome: string;
    pix: number;
    dinheiro: number;
    operadorId: string | null;
  }
) {
  const valor = round2(opts.pix + opts.dinheiro);
  if (valor <= 0.009) throw new Error("Informe um valor para receber.");

  const pixRestante = { v: opts.pix };
  const dinheiroRestante = { v: opts.dinheiro };
  const forma = deriveFormaPagamento(opts.pix, opts.dinheiro);

  const aplicado = await aplicarPagamentoDividaAnterior(supabase, {
    empresaId: opts.empresaId,
    pontoId: opts.pontoId,
    pontoNome: opts.pontoNome,
    valor,
    pixRestante,
    dinheiroRestante,
    formaPagamento: forma,
    operadorId: opts.operadorId,
    excluirVisitaPontoId: opts.visitaPontoId,
  });

  const { data: visita } = await supabase
    .from("visitas_ponto")
    .select("divida_recebida_inicio")
    .eq("id", opts.visitaPontoId)
    .single();

  const novoInicio = round2(Number(visita?.divida_recebida_inicio ?? 0) + aplicado);
  await supabase
    .from("visitas_ponto")
    .update({ divida_recebida_inicio: novoInicio })
    .eq("id", opts.visitaPontoId);

  return { aplicado, dividaRecebidaInicio: novoInicio, haver: round2(valor - aplicado) };
}

export async function finalizarVisitaPontoComCheckout(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaPontoId: string;
    desconto: number;
    pix: number;
    dinheiro: number;
    operadorId: string | null;
    /**
     * Pagamento já aplicado na coleta (receber agora).
     * Só fecha a visita ao ponto — não cobra de novo nem cria visita_consolidada.
     */
    somenteFechar?: boolean;
    /** Abate haver aberto do ponto no total da visita. */
    descontarHaver?: boolean;
    /** Se false, cobra só a visita de hoje — dívida antiga fica de fora. Default true. */
    incluirDivida?: boolean;
  }
) {
  const resumo = await fetchVisitaPontoResumo(supabase, opts.empresaId, opts.visitaPontoId);
  if (!resumo) throw new Error("Visita não encontrada.");
  if (resumo.status !== "rascunho") throw new Error("Esta visita já foi finalizada.");
  if (resumo.itensConcluidos === 0) throw new Error("Registre pelo menos uma coleta.");

  const { data: visitaRow } = await supabase
    .from("visitas_ponto")
    .select("divida_recebida_inicio, ponto_id, pontos(nome)")
    .eq("id", opts.visitaPontoId)
    .single();

  const ponto = Array.isArray(visitaRow?.pontos) ? visitaRow.pontos[0] : visitaRow?.pontos;
  const pontoNome = (ponto as { nome?: string } | null)?.nome ?? resumo.pontoNome;
  const dividaRecebidaInicio = Number(visitaRow?.divida_recebida_inicio ?? 0);

  const cassinoVisitaIds = await fetchCassinoVisitaIdsVisitaPonto(
    supabase,
    opts.visitaPontoId
  );

  const dividaAnteriorTotal = await totalDividaAnteriorPonto(
    supabase,
    opts.empresaId,
    resumo.pontoId,
    {
      excluirVisitaPontoId: opts.visitaPontoId,
      excluirVisitaIds: cassinoVisitaIds,
    }
  );

  // Receber agora: pagamento já entrou na coleta/pendências. Fechar sem reprocessar.
  // Importante: após pagar, subtotalCobravel fica 0 — não gravar total_cobrado=0.
  if (opts.somenteFechar) {
    // Garante que visita_consolidada / pendências órfãs sumam quando as coletas já foram pagas.
    await reconciliarPendenciasCobraveisPonto(supabase, {
      empresaId: opts.empresaId,
      pontoId: resumo.pontoId,
    });

    const dividaAposSync = await totalDividaAnteriorPonto(
      supabase,
      opts.empresaId,
      resumo.pontoId,
      {
        excluirVisitaPontoId: opts.visitaPontoId,
        excluirVisitaIds: cassinoVisitaIds,
      }
    );

    const totalRecebido = round2(Math.max(0, resumo.totalRecebido ?? 0));
    const aindaAberto = round2(Math.max(0, resumo.subtotalCobravel) + dividaAposSync);
    const pagoInformado = round2(Math.max(0, opts.pix) + Math.max(0, opts.dinheiro));
    const valorPago = round2(
      totalRecebido > 0.009 ? totalRecebido : pagoInformado
    );
    // O que esta visita representou na cobrança = já recebido + o que ainda falta.
    const totalCobrado = round2(valorPago + aindaAberto);
    const forma = deriveFormaPagamento(opts.pix, opts.dinheiro);

    await supabase
      .from("visitas_ponto")
      .update({
        status: "finalizada",
        finalizada_em: new Date().toISOString(),
        // Snapshot do que foi cobrado/recebido (não o cobravel residual zerado).
        subtotal_cobravel: round2(
          Math.max(resumo.subtotalCobravel, valorPago - dividaAposSync, 0)
        ),
        divida_anterior_total: round2(dividaAposSync + dividaRecebidaInicio),
        desconto: round2(Math.max(0, opts.desconto)),
        valor_pix: round2(Math.max(0, opts.pix)),
        valor_dinheiro: round2(Math.max(0, opts.dinheiro)),
        valor_pago: valorPago,
        total_cobrado: totalCobrado > 0.009 ? totalCobrado : valorPago,
        restante: aindaAberto,
        forma_pagamento: forma,
      })
      .eq("id", opts.visitaPontoId);

    const resumoFinal = await fetchVisitaPontoResumo(supabase, opts.empresaId, opts.visitaPontoId);

    const { marcarParadasConcluidasPorPonto } = await import(
      "@/lib/rotas/marcar-paradas-concluidas"
    );
    await marcarParadasConcluidasPorPonto(supabase, opts.empresaId, resumo.pontoId);

    return {
      calculo: {
        ...calcularCheckoutVisita({
          subtotalCobravel: Math.max(resumo.subtotalCobravel, valorPago),
          dividaAnteriorTotal: dividaAposSync,
          dividaRecebidaInicio: 0,
          desconto: opts.desconto,
          pix: opts.pix,
          dinheiro: opts.dinheiro,
        }),
        // Garante exibição correta mesmo se cobravel já estava 0.
        totalACobrar: totalCobrado > 0.009 ? totalCobrado : valorPago,
        valorPago,
        restante: aindaAberto,
      },
      pendenciaId: null,
      resumo: resumoFinal,
      somenteFechar: true,
    };
  }

  const calculo = calcularCheckoutVisita({
    subtotalCobravel: resumo.subtotalCobravel,
    dividaAnteriorTotal: opts.incluirDivida === false ? 0 : dividaAnteriorTotal,
    dividaRecebidaInicio: 0,
    desconto: opts.desconto,
    pix: opts.pix,
    dinheiro: opts.dinheiro,
    haverSaldo: await fetchHaverSaldoPonto(supabase, opts.empresaId, resumo.pontoId),
    descontarHaver: opts.descontarHaver === true,
  });

  const pixRestante = { v: opts.pix };
  const dinheiroRestante = { v: opts.dinheiro };
  const forma = deriveFormaPagamento(opts.pix, opts.dinheiro);

  // Haver abate só a visita — dinheiro cobre o restante da visita e depois a dívida.
  const haverNaVisita = round2(
    Math.min(calculo.haverAbatido, calculo.aplicadoVisita)
  );
  const cashNaVisita = round2(Math.max(0, calculo.aplicadoVisita - haverNaVisita));

  if (cashNaVisita > 0.009) {
    await aplicarPagamentoItensVisita(supabase, {
      empresaId: opts.empresaId,
      pontoId: resumo.pontoId,
      pontoNome,
      visitaPontoId: opts.visitaPontoId,
      valor: cashNaVisita,
      pixRestante,
      dinheiroRestante,
      formaPagamento: forma,
      operadorId: opts.operadorId,
    });
  }

  if (haverNaVisita > 0.009) {
    await aplicarCreditoHaverItensVisita(supabase, {
      empresaId: opts.empresaId,
      visitaPontoId: opts.visitaPontoId,
      valor: haverNaVisita,
    });
  }

  if (calculo.aplicadoDivida > 0.009) {
    await aplicarPagamentoDividaAnterior(supabase, {
      empresaId: opts.empresaId,
      pontoId: resumo.pontoId,
      pontoNome,
      valor: calculo.aplicadoDivida,
      pixRestante,
      dinheiroRestante,
      formaPagamento: forma,
      operadorId: opts.operadorId,
      excluirVisitaPontoId: opts.visitaPontoId,
      excluirVisitaIds: cassinoVisitaIds,
    });
  }

  if (calculo.haverAbatido > 0.009) {
    await baixarHaverPonto(supabase, {
      empresaId: opts.empresaId,
      pontoId: resumo.pontoId,
      valor: calculo.haverAbatido,
    });
  }

  let pendenciaId: string | null = null;
  // Pendência universal do ponto = só o que faltou da visita de hoje.
  // Dívida antiga já existe em outras linhas; não ratear o restante por nicho.
  const unpaidVisitaHoje = round2(
    Math.max(0, calculo.subtotalAposDesconto - calculo.aplicadoVisita)
  );

  if (unpaidVisitaHoje > 0.009) {
    const linhas = resumo.nichos.map(
      (n) => `${n.label}: ${n.totalCobravel.toFixed(2).replace(".", ",")}`
    );
    const { data: pend } = await supabase
      .from("pendencias")
      .insert({
        empresa_id: opts.empresaId,
        ponto_id: resumo.pontoId,
        visita_ponto_id: opts.visitaPontoId,
        tipo: calculo.valorPago > 0.009 ? "parcial" : "visita_consolidada",
        titulo: `Visita ao ponto — ${new Date().toLocaleDateString("pt-BR")}`,
        descricao: [
          pontoNome,
          ...linhas,
          `Total visita: R$ ${calculo.subtotalAposDesconto.toFixed(2)}`,
          `Pago: R$ ${calculo.valorPago.toFixed(2)}`,
          `Pendência universal: R$ ${unpaidVisitaHoje.toFixed(2)}`,
        ].join(" · "),
        valor: unpaidVisitaHoje,
        status: "aberta",
        prioridade: "media",
      })
      .select("id")
      .single();
    pendenciaId = pend?.id ?? null;

    await absorverSaldosItensVisitaNaConsolidada(supabase, {
      empresaId: opts.empresaId,
      visitaPontoId: opts.visitaPontoId,
    });
  }

  if (calculo.haver > 0.009) {
    await registrarHaverFuraFura(supabase, {
      empresaId: opts.empresaId,
      pontoId: resumo.pontoId,
      pontoNome,
      valor: calculo.haver,
      valorPix: pixRestante.v,
      valorDinheiro: dinheiroRestante.v,
      motivo: `Pagamento a maior na visita de ${new Date().toLocaleDateString("pt-BR")}`,
      operadorId: opts.operadorId,
      registrarFinanceiro: true,
    });
  }

  await supabase
    .from("visitas_ponto")
    .update({
      status: "finalizada",
      finalizada_em: new Date().toISOString(),
      subtotal_cobravel: calculo.subtotalCobravel,
      divida_anterior_total: round2(dividaAnteriorTotal + dividaRecebidaInicio),
      desconto: calculo.desconto,
      valor_pix: opts.pix,
      valor_dinheiro: opts.dinheiro,
      valor_pago: calculo.valorPago,
      total_cobrado: calculo.totalACobrar,
      restante: calculo.restante,
      forma_pagamento: forma,
    })
    .eq("id", opts.visitaPontoId);

  const resumoFinal = await fetchVisitaPontoResumo(supabase, opts.empresaId, opts.visitaPontoId);

  const { marcarParadasConcluidasPorPonto } = await import(
    "@/lib/rotas/marcar-paradas-concluidas"
  );
  await marcarParadasConcluidasPorPonto(supabase, opts.empresaId, resumo.pontoId);

  return { calculo, pendenciaId, resumo: resumoFinal };
}

export async function baixarPendenciaVisitaPonto(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pendenciaId: string;
    visitaPontoId: string;
    pontoId: string;
    pontoNome: string;
    valorPix: number;
    valorDinheiro: number;
    operadorId: string | null;
    observacao?: string;
  }
) {
  const valorPago = round2(opts.valorPix + opts.valorDinheiro);
  if (valorPago <= 0.009) throw new Error("Informe um valor válido.");

  const { data: pendencia } = await supabase
    .from("pendencias")
    .select("valor, descricao, tipo")
    .eq("id", opts.pendenciaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (!pendencia) throw new Error("Pendência não encontrada.");

  const saldoPend = Number(pendencia.valor ?? 0);
  const aplicar = round2(Math.min(valorPago, saldoPend));
  if (aplicar <= 0.009) throw new Error("Valor maior que o saldo da pendência.");

  const pixRestante = { v: opts.valorPix };
  const dinheiroRestante = { v: opts.valorDinheiro };
  const forma = deriveFormaPagamento(opts.valorPix, opts.valorDinheiro);

  await aplicarPagamentoItensVisita(supabase, {
    empresaId: opts.empresaId,
    pontoId: opts.pontoId,
    pontoNome: opts.pontoNome,
    visitaPontoId: opts.visitaPontoId,
    valor: aplicar,
    pixRestante,
    dinheiroRestante,
    formaPagamento: forma,
    operadorId: opts.operadorId,
  });

  const restante = round2(Math.max(0, saldoPend - aplicar));
  const dataStr = new Date().toLocaleDateString("pt-BR");
  const linha = `Baixa de R$ ${aplicar.toFixed(2).replace(".", ",")} em ${dataStr}${
    opts.observacao ? ` — ${opts.observacao}` : ""
  }`;

  await supabase
    .from("pendencias")
    .update({
      valor: restante,
      status: restante <= 0.009 ? "resolvida" : "aberta",
      resolvido_em: restante <= 0.009 ? new Date().toISOString() : null,
      descricao: pendencia.descricao ? `${pendencia.descricao}\n${linha}` : linha,
    })
    .eq("id", opts.pendenciaId);

  const { data: visitaRow } = await supabase
    .from("visitas_ponto")
    .select("valor_pago, restante")
    .eq("id", opts.visitaPontoId)
    .maybeSingle();

  if (visitaRow) {
    const novoPago = round2(Number(visitaRow.valor_pago ?? 0) + aplicar);
    const novoRestante = round2(Math.max(0, Number(visitaRow.restante ?? 0) - aplicar));
    await supabase
      .from("visitas_ponto")
      .update({ valor_pago: novoPago, restante: novoRestante })
      .eq("id", opts.visitaPontoId);
  }

  return { aplicado: aplicar, restante };
}
