import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisitaPontoNicho } from "@/lib/visitas-ponto/types";

type VincularParams = {
  supabase: SupabaseClient;
  empresaId: string;
  visitaPontoId: string;
  nicho: VisitaPontoNicho;
  cassinoVisitaId?: string;
  coletaIds?: string[];
  grupoId?: string;
  /**
   * Após editar coleta já finalizada: permite religar o item cassino
   * (slot com cassino_visita_id nulo) sem reabrir o rascunho.
   */
  permitirReligarFinalizada?: boolean;
};

export async function vincularItemVisitaPonto({
  supabase,
  empresaId,
  visitaPontoId,
  nicho,
  cassinoVisitaId,
  coletaIds,
  grupoId,
  permitirReligarFinalizada = false,
}: VincularParams): Promise<void> {
  const { data: visita } = await supabase
    .from("visitas_ponto")
    .select("id, status, empresa_id")
    .eq("id", visitaPontoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!visita) {
    throw new Error("Visita ao ponto não encontrada.");
  }
  const finalizada = visita.status !== "rascunho";

  const { data: ultimo } = await supabase
    .from("visita_ponto_itens")
    .select("ordem")
    .eq("visita_ponto_id", visitaPontoId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ordem = (ultimo?.ordem ?? -1) + 1;
  const batchGrupo = grupoId ?? (coletaIds && coletaIds.length > 1 ? crypto.randomUUID() : null);

  if (cassinoVisitaId) {
    // Slot liberado na exclusão/correção (soft-unlink) — só atualiza o vínculo.
    const { data: slotLivre } = await supabase
      .from("visita_ponto_itens")
      .select("id")
      .eq("visita_ponto_id", visitaPontoId)
      .eq("empresa_id", empresaId)
      .eq("nicho", nicho)
      .is("cassino_visita_id", null)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (slotLivre?.id) {
      const { error } = await supabase
        .from("visita_ponto_itens")
        .update({ cassino_visita_id: cassinoVisitaId })
        .eq("id", slotLivre.id)
        .eq("empresa_id", empresaId);
      if (error) throw new Error(error.message);
      return;
    }

    if (finalizada && !permitirReligarFinalizada) {
      throw new Error("Esta visita já foi finalizada.");
    }

    const { error } = await supabase.from("visita_ponto_itens").insert({
      visita_ponto_id: visitaPontoId,
      empresa_id: empresaId,
      nicho,
      cassino_visita_id: cassinoVisitaId,
      ordem,
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (finalizada && !permitirReligarFinalizada) {
    throw new Error("Esta visita já foi finalizada.");
  }

  if (!coletaIds?.length) {
    throw new Error("Nenhuma coleta para vincular à visita.");
  }

  for (const coletaId of coletaIds) {
    // Slot liberado na exclusão/correção (soft-unlink) — só atualiza o vínculo.
    const { data: slotLivre } = await supabase
      .from("visita_ponto_itens")
      .select("id")
      .eq("visita_ponto_id", visitaPontoId)
      .eq("empresa_id", empresaId)
      .eq("nicho", nicho)
      .is("coleta_id", null)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (slotLivre?.id) {
      const { error } = await supabase
        .from("visita_ponto_itens")
        .update({ coleta_id: coletaId })
        .eq("id", slotLivre.id)
        .eq("empresa_id", empresaId);
      if (error) throw new Error(error.message);
      continue;
    }

    if (finalizada && !permitirReligarFinalizada) {
      throw new Error("Esta visita já foi finalizada.");
    }

    const { error } = await supabase.from("visita_ponto_itens").insert({
      visita_ponto_id: visitaPontoId,
      empresa_id: empresaId,
      nicho,
      coleta_id: coletaId,
      grupo_id: batchGrupo,
      ordem,
    });
    if (error) throw new Error(error.message);
    ordem++;
  }
}

export function parseVisitaPontoId(raw: unknown): string | null {
  const id = String(raw ?? "").trim();
  return id.length > 0 ? id : null;
}
