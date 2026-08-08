import type { SupabaseClient } from "@supabase/supabase-js";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Quando uma pendência de operação (pagamento_pendente / parcial / visita_consolidada)
 * é baixada, a visita cassino de origem também precisa refletir a baixa.
 * Sem isso o checkout recalcula cobravel nas visitas e recria dívida (bola de neve).
 *
 * `semRecebimento: true` — abate em visita **negativa** (cliente usou a dívida
 * para cobrir prejuízo). Zera/reduz o cobravel **sem** aumentar `valor_pago`,
 * senão a Análise conta dinheiro que nunca entrou no caixa.
 */
export async function sincronizarVisitaAposBaixaOperacao(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaId: string | null | undefined;
    valorAbatidoReais: number;
    /** Baixa por prejuízo/negativo — não é recebimento de caixa. */
    semRecebimento?: boolean;
  }
): Promise<void> {
  const visitaId = opts.visitaId;
  const abatido = round2(Math.max(0, opts.valorAbatidoReais));
  if (!visitaId || abatido <= 0.009) return;

  const { data: visita } = await supabase
    .from("visitas")
    .select(
      "id, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido, saldo_negativo"
    )
    .eq("id", visitaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (!visita || visita.saldo_negativo) return;

  const cobravel = cobravelCassinoVisita(visita);
  const aplicar = round2(Math.min(abatido, cobravel));
  if (aplicar <= 0.009) return;

  const pagoAtual = Number(visita.valor_pago ?? 0);
  const restanteAtual = Number(visita.restante ?? NaN);
  const novoRestante = Number.isFinite(restanteAtual)
    ? round2(Math.max(0, restanteAtual - aplicar))
    : round2(Math.max(0, cobravel - aplicar));

  if (opts.semRecebimento) {
    await supabase
      .from("visitas")
      .update({ restante: novoRestante })
      .eq("id", visita.id)
      .eq("empresa_id", opts.empresaId);
    return;
  }

  const novoPago = round2(pagoAtual + aplicar);

  await supabase
    .from("visitas")
    .update({
      valor_pago: novoPago,
      restante: novoRestante,
    })
    .eq("id", visita.id)
    .eq("empresa_id", opts.empresaId);
}

/**
 * Desfaz `sincronizarVisitaAposBaixaOperacao` ao excluir a visita que abateu.
 * Sem isso, `reconciliarPendenciasCobraveisPonto` vê cobravel 0 e zera de novo
 * a pendência que acabamos de restaurar.
 */
export async function reverterSincronizacaoVisitaAposBaixaOperacao(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    visitaId: string | null | undefined;
    valorAbatidoReais: number;
  }
): Promise<void> {
  const visitaId = opts.visitaId;
  const abatido = round2(Math.max(0, opts.valorAbatidoReais));
  if (!visitaId || abatido <= 0.009) return;

  const { data: visita } = await supabase
    .from("visitas")
    .select(
      "id, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido, saldo_negativo"
    )
    .eq("id", visitaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (!visita || visita.saldo_negativo) return;

  const pago = Number(visita.valor_pago ?? 0);
  const restante = Number(visita.restante ?? 0);
  const novoRestante = round2(restante + abatido);

  if (pago > 0.009) {
    const novoPago = round2(Math.max(0, pago - abatido));
    await supabase
      .from("visitas")
      .update({ valor_pago: novoPago, restante: novoRestante })
      .eq("id", visita.id)
      .eq("empresa_id", opts.empresaId);
    return;
  }

  await supabase
    .from("visitas")
    .update({ restante: novoRestante })
    .eq("id", visita.id)
    .eq("empresa_id", opts.empresaId);
}
