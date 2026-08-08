import type { OwnerProfileAcesso } from "@/lib/assinatura-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

type ProfileAcessoAtual = OwnerProfileAcesso & {
  user_id?: string | null;
};

/**
 * Acesso de trial/cortesia/assinatura segue o **dono da empresa**.
 * Membros da equipe não leem o perfil do owner via RLS (só o próprio),
 * então usamos service role quando o logado não é o owner.
 */
export async function resolverOwnerProfileAcesso(
  profile: ProfileAcessoAtual | null | undefined,
  ownerId: string | null | undefined
): Promise<OwnerProfileAcesso> {
  const fallback: OwnerProfileAcesso = {
    assinatura_ativa: profile?.assinatura_ativa ?? false,
    trial_fim: profile?.trial_fim ?? null,
    trial_inicio: profile?.trial_inicio ?? null,
  };

  if (!ownerId) return fallback;
  if (profile?.user_id && profile.user_id === ownerId) return fallback;
  if (!isAdminConfigured()) return fallback;

  try {
    const admin = createAdminClient();
    const { data: ownerProf } = await admin
      .from("profiles")
      .select("assinatura_ativa, trial_fim, trial_inicio")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!ownerProf) return fallback;
    return {
      assinatura_ativa: Boolean(ownerProf.assinatura_ativa),
      trial_fim: ownerProf.trial_fim ?? null,
      trial_inicio: ownerProf.trial_inicio ?? null,
    };
  } catch {
    return fallback;
  }
}
