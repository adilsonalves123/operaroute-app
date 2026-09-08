import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { AcessoUsuario } from "@/lib/equipe/acesso";

export type VisaoOperador = {
  restrita: boolean;
  equipeId: string | null;
  pontoIds: string[];
};

const VISAO_VAZIA: VisaoOperador = {
  restrita: false,
  equipeId: null,
  pontoIds: [],
};

export const resolverVisaoOperador = cache(async (
  supabase: SupabaseClient,
  acesso: AcessoUsuario
): Promise<VisaoOperador> => {
  if (acesso.isOwner || !acesso.visaoRestrita || !acesso.equipeId) {
    return { ...VISAO_VAZIA, equipeId: acesso.equipeId };
  }

  const { data } = await supabase
    .from("visao_pontos")
    .select("ponto_id")
    .eq("equipe_id", acesso.equipeId);

  return {
    restrita: true,
    equipeId: acesso.equipeId,
    pontoIds: (data ?? []).map((r) => r.ponto_id).filter(Boolean),
  };
});

export function aplicarFiltroIdsPontos<Q>(
  query: Q,
  visao: VisaoOperador
): Q {
  if (!visao.restrita) return query;
  const q = query as Q & {
    in: (col: string, ids: string[]) => Q;
    eq: (col: string, v: string) => Q;
  };
  if (visao.pontoIds.length === 0) {
    return q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  return q.in("id", visao.pontoIds);
}

