import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type DashboardPontoBase = {
  id: string;
  nome: string;
  status: string;
  ultima_coleta: string | null;
  created_at?: string | null;
};

/** Última atividade de visita: coleta real, ou cadastro se ainda nunca coletou. */
export function referenciaUltimaVisitaPonto(ponto: {
  ultima_coleta?: string | null;
  created_at?: string | null;
}): Date | null {
  const ts = ponto.ultima_coleta ?? ponto.created_at ?? null;
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Alerta "sem coleta há mais de N dias".
 * Pontos novos (cadastrados há menos de N dias e ainda sem coleta) NÃO entram —
 * só após passar o prazo desde a última coleta ou, se nunca coletou, desde o cadastro.
 */
export function pontoSemColetaHaMaisDe(
  ponto: { ultima_coleta?: string | null; created_at?: string | null },
  limite: Date
): boolean {
  const ref = referenciaUltimaVisitaPonto(ponto);
  return ref != null && ref < limite;
}

export const fetchDashboardPontosBase = cache(async (
  supabase: SupabaseClient,
  empresaId: string
): Promise<DashboardPontoBase[]> => {
  const { data } = await supabase
    .from("pontos")
    .select("id, nome, status, ultima_coleta, created_at")
    .eq("empresa_id", empresaId);

  return (data ?? []) as DashboardPontoBase[];
});
