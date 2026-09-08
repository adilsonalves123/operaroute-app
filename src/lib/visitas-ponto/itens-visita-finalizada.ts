import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura/pagamentos-fifo";

export type ItensVisitaPontoFinalizada = {
  coletaIds: Set<string>;
  cassinoVisitaIds: Set<string>;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Coletas / visitas cassino já fechadas no checkout da visita ao ponto.
 * A dívida restante vive na pendência universal — não somar de novo no “A receber”.
 */
export const fetchItensVisitaPontoFinalizada = cache(
  async (
    supabase: SupabaseClient,
    empresaId: string
  ): Promise<ItensVisitaPontoFinalizada> => {
    const { data: visitas } = await supabase
      .from("visitas_ponto")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("status", "finalizada");

    const vpIds = (visitas ?? []).map((v) => v.id as string).filter(Boolean);
    const coletaIds = new Set<string>();
    const cassinoVisitaIds = new Set<string>();
    if (vpIds.length === 0) return { coletaIds, cassinoVisitaIds };

    const { data: itens } = await supabase
      .from("visita_ponto_itens")
      .select("coleta_id, cassino_visita_id")
      .in("visita_ponto_id", vpIds);

    for (const i of itens ?? []) {
      if (i.coleta_id) coletaIds.add(i.coleta_id);
      if (i.cassino_visita_id) cassinoVisitaIds.add(i.cassino_visita_id);
    }
    return { coletaIds, cassinoVisitaIds };
  }
);

export function somarSaldoColetasNaoMigradas(
  rows: Array<{
    id?: string | null;
    valor_a_receber?: number | null;
    valor_pago_recebido?: number | null;
  }>,
  coletaIdsMigradas: Set<string>
): number {
  return round2(
    rows.reduce((s, c) => {
      if (c.id && coletaIdsMigradas.has(c.id)) return s;
      return s + saldoPendenteColeta(c);
    }, 0)
  );
}
