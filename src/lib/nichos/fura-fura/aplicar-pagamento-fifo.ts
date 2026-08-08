import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";
import { splitExcedentePagamento } from "./haver-ponto";
import {
  distribuirPagamentoFifo,
  saldoPendenteColeta,
  type ColetaPendente,
  type DistribuicaoPagamento,
} from "./pagamentos-fifo";
import { reconciliarPendenciasCobraveisPonto } from "@/lib/visitas-ponto/reconciliar-pendencias-ponto";

export async function aplicarPagamentoFifoColetas(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    pontoNome: string;
    coletas: ColetaPendente[];
    valor: number;
    pixRestante: { v: number };
    dinheiroRestante: { v: number };
    formaPagamento: string;
    operadorId: string | null;
    observacao?: string;
    categoriaFinanceiro?: string;
  }
): Promise<{ distribuicoes: DistribuicaoPagamento[]; valorAplicado: number; valorSobra: number }> {
  const pendentes = opts.coletas.filter((c) => saldoPendenteColeta(c) > 0.009);

  const { distribuicoes, valorAplicado, valorSobra } =
    pendentes.length > 0
      ? distribuirPagamentoFifo(pendentes, opts.valor)
      : { distribuicoes: [], valorAplicado: 0, valorSobra: opts.valor };

  const categoria = opts.categoriaFinanceiro ?? "Recebimento coleta";

  for (const d of distribuicoes) {
    const col = pendentes.find((c) => c.id === d.coletaId)!;
    const novoPago = Math.round((Number(col.valor_pago_recebido ?? 0) + d.valor) * 100) / 100;
    const { pix, dinheiro } = splitExcedentePagamento(
      d.valor,
      opts.pixRestante,
      opts.dinheiroRestante
    );
    const pagamentoDetalhe = formatPagamentoDetalhe(pix, dinheiro);

    await supabase
      .from("coletas")
      .update({ valor_pago_recebido: novoPago })
      .eq("id", d.coletaId)
      .eq("empresa_id", opts.empresaId);

    col.valor_pago_recebido = novoPago;

    await supabase.from("coleta_pagamentos").insert({
      empresa_id: opts.empresaId,
      coleta_id: d.coletaId,
      ponto_id: opts.pontoId,
      valor: d.valor,
      valor_pix: pix,
      valor_dinheiro: dinheiro,
      forma_pagamento: opts.formaPagamento,
      observacao: opts.observacao ?? "Pagamento consolidado",
      operador_id: opts.operadorId,
    });

    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria,
      valor: d.valor,
      descricao: pagamentoDetalhe
        ? `Pagamento coleta — ${opts.pontoNome} — ${pagamentoDetalhe}`
        : `Pagamento coleta — ${opts.pontoNome}`,
      forma_pagamento: opts.formaPagamento,
      ponto_id: opts.pontoId,
      coleta_id: d.coletaId,
      operador_id: opts.operadorId,
    });

    const novoSaldo = saldoPendenteColeta({
      valor_a_receber: Number(col.valor_a_receber ?? 0),
      valor_pago_recebido: novoPago,
    });

    if (novoSaldo <= 0.009) {
      await supabase
        .from("pendencias")
        .update({ status: "resolvida", valor: 0, resolvido_em: new Date().toISOString() })
        .eq("coleta_id", d.coletaId)
        .eq("empresa_id", opts.empresaId)
        .eq("status", "aberta");
    } else {
      await supabase
        .from("pendencias")
        .update({ valor: novoSaldo })
        .eq("coleta_id", d.coletaId)
        .eq("empresa_id", opts.empresaId)
        .eq("status", "aberta");
    }
  }

  if (valorAplicado > 0.009) {
    await reconciliarPendenciasCobraveisPonto(supabase, {
      empresaId: opts.empresaId,
      pontoId: opts.pontoId,
    });
  }

  return { distribuicoes, valorAplicado, valorSobra };
}
