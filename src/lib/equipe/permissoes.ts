import type { SupabaseClient } from "@supabase/supabase-js";
import type { Empresa, Profile, UserRole } from "@/lib/types/database";

export async function canManageEquipe(
  supabase: SupabaseClient,
  profile: Profile,
  ownerId?: string | null
): Promise<boolean> {
  if (!profile.empresa_id) return false;
  if (ownerId && ownerId === profile.user_id) return true;

  const { data } = await supabase
    .from("equipe")
    .select("role")
    .eq("empresa_id", profile.empresa_id)
    .eq("user_id", profile.user_id)
    .maybeSingle();

  return data?.role === "admin" || data?.role === "gerente";
}

export async function getEquipeRole(
  supabase: SupabaseClient,
  empresaId: string,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from("equipe")
    .select("role")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.role as UserRole) ?? null;
}
