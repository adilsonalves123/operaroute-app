import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";
import { getAcessoUsuario } from "@/lib/equipe/acesso";

/** Montar, atribuir e enviar rotas — usa permissão rotas (criar/editar), não só cargo de equipe. */
export async function canGerenciarRotas(
  supabase: SupabaseClient,
  profile: Profile,
  ownerId?: string | null
): Promise<boolean> {
  const acesso = await getAcessoUsuario(supabase, profile, ownerId);
  return acesso.podeGerenciarRotas;
}
