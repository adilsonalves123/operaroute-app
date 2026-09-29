import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

export const CHAVE_EMPRESA_LEMBRADA = "or_campo_empresa";

function lembrarEmpresa(userId: string, empresaId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CHAVE_EMPRESA_LEMBRADA,
      JSON.stringify({ user_id: userId, empresa_id: empresaId })
    );
  } catch {
    /* ignore */
  }
}

/** Sem sinal a sessão não renova — usa a empresa da última vez que deu certo neste aparelho. */
function empresaLembrada(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = localStorage.getItem(CHAVE_EMPRESA_LEMBRADA);
    const salvo = bruto ? (JSON.parse(bruto) as { empresa_id?: unknown }) : null;
    return typeof salvo?.empresa_id === "string" ? salvo.empresa_id : null;
  } catch {
    return null;
  }
}

export async function getEmpresaIdForUser(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    return userError && isAuthRetryableFetchError(userError) ? empresaLembrada() : null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id, onboarding_completo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.empresa_id) {
    lembrarEmpresa(user.id, profile.empresa_id);
    return profile.empresa_id;
  }

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
    lembrarEmpresa(user.id, empresa.id);
    return empresa.id;
  }

  return null;
}
