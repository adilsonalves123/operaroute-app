import type { SupabaseClient } from "@supabase/supabase-js";

export async function getEmpresaIdForUser(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id, onboarding_completo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.empresa_id) return profile.empresa_id;

  // Fallback: empresa criada mas profile sem empresa_id
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empresa?.id) {
    await supabase
      .from("profiles")
      .update({
        empresa_id: empresa.id,
        onboarding_completo: true,
      })
      .eq("user_id", user.id);
    return empresa.id;
  }

  return null;
}
