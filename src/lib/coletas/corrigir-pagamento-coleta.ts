import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveFormaPagamento,
  formatPagamentoDetalhe,
} from "@/lib/financeiro/forma-pagamento";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const CATEGORIA_POR_NICHO: Record<string, string> = {
  fura_fura: "Coleta fura-fura",
  ursinho: "Coleta ursinho",
  bolinha: "Coleta Bolinha",
  diversao: "Coleta diversão",
  consignado: "Coleta Consignado",
};

const TITULO_PENDENCIA_POR_NICHO: Record<string, string> = {
  fura_fura: "Coleta fura-fura pendente",
  ursinho: "Coleta ursinho pendente",
  bolinha: "Coleta bolinha pendente",
  diversao: "Coleta diversão pendente",
  consignado: "Coleta consignado pendente",
};

/**
 * Corrige só o pagamento da coleta — não recalcula lucro, comissão, brindes nem leituras.
 * Sincroniza financeiro, coleta_pagamentos e pendência ligada à coleta.
 */
export async function corrigirPagamentoColeta(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    coletaId: string;
    pix: number;
    dinheiro: number;
    operadorId?: string | null;
    pontoNome?: string | null;
  }
): Promise<{ ok: true; valorPago: number; saldoPendente: number } | { ok: false; error: string }> {
  const pix = round2(Math.max(0, opts.pix));
  const dinheiro = round2(Math.max(0, opts.dinheiro));
  const pagoInformado = round2(pix + dinheiro);

  const { data: coleta, error } = await supabase
    .from("coletas")
    .select(
      "id, ponto_id, nicho_modulo, valor_a_receber, valor_pago_recebido, valor_pix, valor_dinheiro"
    )
    .eq("id", opts.coletaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (error || !coleta) {
    return { ok: false, error: "Coleta não encontrada." };
  }

  const aReceber = round2(Math.max(0, Number(coleta.valor_a_receber ?? 0)));
  // Não gera haver novo por aqui — só corrige até o valor da cobrança.
  const valorPago = round2(Math.min(pagoInformado, aReceber));
  const fator = pagoInformado > 0.009 ? valorPago / pagoInformado : 0;
  const valorPix = round2(pix * fator);
  const valorDinheiro = round2(dinheiro * fator);
  const forma = deriveFormaPagamento(valorPix, valorDinheiro);
  const saldoPendente = round2(Math.max(0, aReceber - valorPago));
  const nicho = String(coleta.nicho_modulo ?? "");
  const categoria = CATEGORIA_POR_NICHO[nicho] ?? "Coleta";
  const pontoNome = opts.pontoNome?.trim() || "Ponto";
  const detalhe = formatPagamentoDetalhe(valorPix, valorDinheiro);

  const { error: updErr } = await supabase
    .from("coletas")
    .update({
      valor_pix: valorPix,
      valor_dinheiro: valorDinheiro,
      valor_pago_recebido: valorPago,
      forma_pagamento: forma,
    })
    .eq("id", opts.coletaId)
    .eq("empresa_id", opts.empresaId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  // Ledger de pagamentos da coleta: consolida no valor corrigido.
  await supabase.from("coleta_pagamentos").delete().eq("coleta_id", opts.coletaId);

  if (valorPago > 0.009) {
    await supabase.from("coleta_pagamentos").insert({
      empresa_id: opts.empresaId,
      coleta_id: opts.coletaId,
      ponto_id: coleta.ponto_id,
      valor: valorPago,
      valor_pix: valorPix,
      valor_dinheiro: valorDinheiro,
      forma_pagamento: forma,
      observacao: "Pagamento corrigido",
      operador_id: opts.operadorId ?? null,
    });
  }

  // Financeiro: remove entradas da coleta e recria se houver pago.
  await supabase
    .from("financeiro")
    .delete()
    .eq("coleta_id", opts.coletaId)
    .eq("empresa_id", opts.empresaId)
    .eq("tipo", "entrada");

  if (valorPago > 0.009) {
    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria,
      valor: valorPago,
      descricao: detalhe
        ? `Coleta ${pontoNome} — ${detalhe} (corrigido)`
        : `Coleta ${pontoNome} (corrigido)`,
      forma_pagamento: forma,
      ponto_id: coleta.ponto_id,
      coleta_id: opts.coletaId,
      operador_id: opts.operadorId ?? null,
    });
  }

  // Pendência da própria coleta (não mexe em haver nem dívida antiga).
  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("id, status, tipo")
    .eq("empresa_id", opts.empresaId)
    .eq("coleta_id", opts.coletaId);

  const abertas =
    pendencias?.filter((p) => {
      const st = String(p.status ?? "").toLowerCase();
      return st === "aberta" || st === "parcial";
    }) ?? [];

  if (saldoPendente > 0.009) {
    const tipo = valorPago > 0.009 ? "parcial" : "pagamento_pendente";
    if (abertas.length > 0) {
      await supabase
        .from("pendencias")
        .update({
          valor: saldoPendente,
          tipo,
          status: "aberta",
          resolvido_em: null,
        })
        .eq("id", abertas[0].id);
      // Fecha extras se houver
      for (const extra of abertas.slice(1)) {
        await supabase
          .from("pendencias")
          .update({ status: "resolvida", resolvido_em: new Date().toISOString() })
          .eq("id", extra.id);
      }
    } else {
      await supabase.from("pendencias").insert({
        empresa_id: opts.empresaId,
        ponto_id: coleta.ponto_id,
        coleta_id: opts.coletaId,
        tipo,
        titulo: TITULO_PENDENCIA_POR_NICHO[nicho] ?? "Pagamento pendente",
        descricao: `Saldo corrigido da coleta — ${pontoNome}`,
        valor: saldoPendente,
        prioridade: "media",
        status: "aberta",
      });
    }
  } else if (abertas.length > 0) {
    for (const p of abertas) {
      await supabase
        .from("pendencias")
        .update({
          valor: 0,
          status: "resolvida",
          resolvido_em: new Date().toISOString(),
        })
        .eq("id", p.id);
    }
  }

  return { ok: true, valorPago, saldoPendente };
}

/**
 * Corrige pagamento da visita cassino — só campos de pagamento + restante + financeiro.
 */
export async function corrigirPagamentoVisitaCassino(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaId: string;
    pix: number;
    dinheiro: number;
    operadorId?: string | null;
    pontoNome?: string | null;
  }
): Promise<{ ok: true; valorPago: number; restante: number } | { ok: false; error: string }> {
  const pix = round2(Math.max(0, opts.pix));
  const dinheiro = round2(Math.max(0, opts.dinheiro));
  const pagoInformado = round2(pix + dinheiro);

  const { data: visita, error } = await supabase
    .from("visitas")
    .select("id, ponto_id, valor_pago, restante, valor_pix, valor_dinheiro")
    .eq("id", opts.visitaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (error || !visita) {
    return { ok: false, error: "Visita não encontrada." };
  }

  const totalDevido = round2(
    Math.max(0, Number(visita.valor_pago ?? 0) + Number(visita.restante ?? 0))
  );
  const valorPago = round2(Math.min(pagoInformado, totalDevido > 0.009 ? totalDevido : pagoInformado));
  const fator = pagoInformado > 0.009 ? valorPago / pagoInformado : 0;
  const valorPix = round2(pix * (totalDevido > 0.009 ? fator : 1));
  const valorDinheiro = round2(dinheiro * (totalDevido > 0.009 ? fator : 1));
  const forma = deriveFormaPagamento(valorPix, valorDinheiro);
  const restante = round2(Math.max(0, totalDevido - valorPago));
  const pontoNome = opts.pontoNome?.trim() || "Ponto";
  const detalhe = formatPagamentoDetalhe(valorPix, valorDinheiro);

  const { error: updErr } = await supabase
    .from("visitas")
    .update({
      valor_pix: valorPix,
      valor_dinheiro: valorDinheiro,
      valor_pago: valorPago,
      forma_pagamento: forma,
      restante,
    })
    .eq("id", opts.visitaId)
    .eq("empresa_id", opts.empresaId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  await supabase
    .from("financeiro")
    .delete()
    .eq("visita_id", opts.visitaId)
    .eq("empresa_id", opts.empresaId)
    .eq("tipo", "entrada");

  if (valorPago > 0.009) {
    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria: "Coleta cassino",
      valor: valorPago,
      descricao: detalhe
        ? `Visita ${pontoNome} — ${detalhe} (corrigido)`
        : `Visita ${pontoNome} (corrigido)`,
      forma_pagamento: forma,
      ponto_id: visita.ponto_id,
      visita_id: opts.visitaId,
      operador_id: opts.operadorId ?? null,
    });
  }

  return { ok: true, valorPago, restante };
}
