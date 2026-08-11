import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marca paradas pendentes desse ponto como concluídas em rotas em andamento.
 * Não altera cálculos de coleta — só status de rota_pontos / rotas.
 * Idempotente e safe: erros são engolidos para não falhar a coleta.
 */
export async function marcarParadasConcluidasPorPonto(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string
): Promise<{ paradasAtualizadas: number; rotasConcluidas: string[] }> {
  const vazio = { paradasAtualizadas: 0, rotasConcluidas: [] as string[] };
  if (!empresaId || !pontoId) return vazio;

  try {
    const { data: rotas, error: rotasErr } = await supabase
      .from("rotas")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("status", "em_andamento");

    if (rotasErr || !rotas?.length) return vazio;

    const rotaIds = rotas.map((r) => r.id);

    const { data: updated, error: updErr } = await supabase
      .from("rota_pontos")
      .update({ status: "concluida" })
      .in("rota_id", rotaIds)
      .eq("ponto_id", pontoId)
      .eq("status", "pendente")
      .select("id, rota_id");

    if (updErr || !updated?.length) return vazio;

    const rotasAfetadas = [...new Set(updated.map((u) => u.rota_id))];
    const rotasConcluidas: string[] = [];

    for (const rotaId of rotasAfetadas) {
      const { data: pendentes } = await supabase
        .from("rota_pontos")
        .select("id")
        .eq("rota_id", rotaId)
        .eq("status", "pendente")
        .limit(1);

      if (!pendentes?.length) {
        await supabase
          .from("rotas")
          .update({ status: "concluida" })
          .eq("id", rotaId)
          .eq("empresa_id", empresaId)
          .eq("status", "em_andamento");
        rotasConcluidas.push(rotaId);
      }
    }

    return { paradasAtualizadas: updated.length, rotasConcluidas };
  } catch {
    return vazio;
  }
}
