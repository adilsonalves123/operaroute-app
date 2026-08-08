import { createClient } from "@/lib/supabase/server";
import { agruparChamadosPorPonto, type ChamadosResumoEmpresa } from "@/lib/chamados/resumo";
import { cache } from "react";

export const fetchChamadosAbertosResumo = cache(async (
  empresaId: string
): Promise<ChamadosResumoEmpresa> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .select("id, ponto_id, equipamento_id, titulo, status, prioridade, equipamentos(nome)")
    .eq("empresa_id", empresaId)
    .in("status", ["aberta", "em_andamento"])
    .order("created_at", { ascending: false });

  if (error) {
    return { total: 0, porPonto: new Map(), lista: [] };
  }

  const rows = (data ?? []).map((item) => ({
    ...item,
    equipamentos: Array.isArray(item.equipamentos) ? (item.equipamentos[0] ?? null) : item.equipamentos,
  }));

  return agruparChamadosPorPonto(rows);
});
