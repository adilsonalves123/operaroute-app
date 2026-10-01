import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura/pagamentos-fifo";
import { sincronizarVisitaAposBaixaOperacao } from "@/lib/visitas-ponto/sync-visita-baixa";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Propaga edição manual da pendência para coleta/visita de origem.
 * Sem isso, reconciliar e telas que leem `coletas` restauram o valor antigo.
 */
export async function sincronizarOrigemAposEdicaoPendencia(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    coletaId: string | null;
    visitaId: string | null;
    /** Saldo cobrável após a edição (R$). */
    novoSaldoCobravel: number;
    tipo: string;
  }
): Promise<void> {
  const saldo = round2(Math.max(0, opts.novoSaldoCobravel));
  const tipo = (opts.tipo ?? "").toLowerCase();
  if (tipo === "haver" || tipo === "negativo") return;

  if (opts.coletaId) {
    const { data: coleta } = await supabase
      .from("coletas")
      .select("valor_a_receber, valor_pago_recebido")
      .eq("id", opts.coletaId)
      .eq("empresa_id", opts.empresaId)
      .maybeSingle();

    if (!coleta) return;

    const pago = round2(Math.max(0, Number(coleta.valor_pago_recebido ?? 0)));
    await supabase
      .from("coletas")
      .update({ valor_a_receber: round2(pago + saldo) })
      .eq("id", opts.coletaId)
      .eq("empresa_id", opts.empresaId);
    return;
  }

  if (!opts.visitaId) return;

  const { data: visita } = await supabase
    .from("visitas")
    .select("id, valor_pago, restante, saldo_negativo")
    .eq("id", opts.visitaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (!visita || visita.saldo_negativo) return;

  await supabase
    .from("visitas")
    .update({ restante: saldo })
    .eq("id", opts.visitaId)
    .eq("empresa_id", opts.empresaId);
}

/**
 * Propaga recebimento (baixa/quitação na tela de Pendências) para coleta/visita de origem.
 * Sem isso, `reconciliarPendenciasCobraveisPonto` espelha o saldo antigo da origem
 * e devolve à pendência o valor já baixado.
 */
export async function sincronizarOrigemAposBaixaPendencia(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    coletaId: string | null;
    visitaId: string | null;
    valorRecebidoReais: number;
    tipo: string;
  }
): Promise<void> {
  const valor = round2(Math.max(0, opts.valorRecebidoReais));
  const tipo = (opts.tipo ?? "").toLowerCase();
  if (valor <= 0.009 || tipo === "haver" || tipo === "negativo") return;

  if (opts.coletaId) {
    const { data: coleta } = await supabase
      .from("coletas")
      .select("valor_a_receber, valor_pago_recebido")
      .eq("id", opts.coletaId)
      .eq("empresa_id", opts.empresaId)
      .maybeSingle();

    if (!coleta) return;

    const aplicar = round2(Math.min(valor, saldoPendenteColeta(coleta)));
    if (aplicar <= 0.009) return;

    await supabase
      .from("coletas")
      .update({
        valor_pago_recebido: round2(Number(coleta.valor_pago_recebido ?? 0) + aplicar),
      })
      .eq("id", opts.coletaId)
      .eq("empresa_id", opts.empresaId);
    return;
  }

  await sincronizarVisitaAposBaixaOperacao(supabase, {
    empresaId: opts.empresaId,
    visitaId: opts.visitaId,
    valorAbatidoReais: valor,
  });
}
