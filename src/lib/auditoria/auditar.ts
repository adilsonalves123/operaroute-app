import type { SupabaseClient } from "@supabase/supabase-js";
import {
  registrarAuditoria,
  requestMeta,
  type RegistrarAuditoriaInput,
} from "@/lib/auditoria/registrar";

type ProfileMini = {
  empresa_id: string | null;
  user_id: string;
  nome: string;
  email?: string | null;
};

/** Atalho: preenche empresa/usuário a partir do profile. */
export async function auditarAcao(
  supabase: SupabaseClient,
  profile: ProfileMini,
  input: Omit<
    RegistrarAuditoriaInput,
    "supabase" | "empresaId" | "userId" | "userNome" | "userEmail"
  > & { request?: Request | null }
): Promise<void> {
  if (!profile.empresa_id) return;
  const { request, ...rest } = input;
  const meta = request ? requestMeta(request) : { ip: null, userAgent: null };
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: profile.email ?? null,
    ip: rest.ip ?? meta.ip,
    userAgent: rest.userAgent ?? meta.userAgent,
    ...rest,
  });
}
