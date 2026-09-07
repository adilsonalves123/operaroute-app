import type { SupabaseClient } from "@supabase/supabase-js";

export async function substituirVisaoPontos(
  supabase: SupabaseClient,
  empresaId: string,
  equipeId: string,
  pontoIds: string[]
): Promise<{ error: string | null }> {
  const unicos = [...new Set(pontoIds.filter(Boolean))];

  if (unicos.length > 0) {
    const { data: pontosOk, error: pontosErr } = await supabase
      .from("pontos")
      .select("id")
      .eq("empresa_id", empresaId)
      .in("id", unicos);

    if (pontosErr) return { error: pontosErr.message };
    if ((pontosOk ?? []).length !== unicos.length) {
      return { error: "Um ou mais pontos não pertencem à operação." };
    }
  }

  const { error: delErr } = await supabase
    .from("visao_pontos")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("equipe_id", equipeId);

  if (delErr) return { error: delErr.message };

  if (unicos.length === 0) return { error: null };

  const { error: insErr } = await supabase.from("visao_pontos").insert(
    unicos.map((ponto_id) => ({
      empresa_id: empresaId,
      equipe_id: equipeId,
      ponto_id,
    }))
  );

  return { error: insErr?.message ?? null };
}
