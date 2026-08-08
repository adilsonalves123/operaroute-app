import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type DashboardPontoBase = {
  id: string;
  nome: string;
  status: string;
  ultima_coleta: string | null;
};

export const fetchDashboardPontosBase = cache(async (
  supabase: SupabaseClient,
  empresaId: string
): Promise<DashboardPontoBase[]> => {
  const { data } = await supabase
    .from("pontos")
    .select("id, nome, status, ultima_coleta")
    .eq("empresa_id", empresaId);

  return (data ?? []) as DashboardPontoBase[];
});
