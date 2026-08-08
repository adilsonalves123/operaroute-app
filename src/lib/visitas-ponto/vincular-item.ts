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
};

export async function vincularItemVisitaPonto({
  supabase,
  empresaId,
  visitaPontoId,
  nicho,
  cassinoVisitaId,
  coletaIds,
  grupoId,
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
  if (visita.status !== "rascunho") {
    throw new Error("Esta visita já foi finalizada.");
  }

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

  if (!coletaIds?.length) {
    throw new Error("Nenhuma coleta para vincular à visita.");
  }

  for (const coletaId of coletaIds) {
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
