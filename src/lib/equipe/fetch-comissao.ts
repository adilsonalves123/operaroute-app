import type { SupabaseClient } from "@supabase/supabase-js";
import { clampComissaoPercentual } from "@/lib/equipe/comissao-staff";

/** Comissão (%) do membro de equipe pelo user_id. */
export async function fetchComissaoEquipePorUserId(
  supabase: SupabaseClient,
  empresaId: string,
  userId: string | null | undefined
): Promise<number> {
  if (!userId) return 0;
  const { data } = await supabase
    .from("equipe")
    .select("comissao_percentual")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .maybeSingle();
  return clampComissaoPercentual(data?.comissao_percentual);
}
