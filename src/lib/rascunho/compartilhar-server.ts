import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gerarTokenResumoRascunho,
  resumoRascunhoPublicUrl,
  type ResumoRascunhoSnapshot,
} from "@/lib/rascunho/compartilhar";

export async function carregarResumoRascunhoPorToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ snapshot: ResumoRascunhoSnapshot } | null> {
  const { data, error } = await supabase
    .from("public_rascunho_resumos")
    .select("snapshot, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("public_rascunho_resumos") ||
      error.code === "PGRST204" ||
      error.code === "42501"
    ) {
      throw new Error(
        "Rode no Supabase o SQL supabase/rascunho-compartilhar.sql (política de leitura pública)."
      );
    }
    return null;
  }

  if (!data?.snapshot) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  return { snapshot: data.snapshot as ResumoRascunhoSnapshot };
}

export async function gravarResumoRascunhoPublico(
  supabase: SupabaseClient,
  empresaId: string,
  snapshot: ResumoRascunhoSnapshot,
  origin?: string
): Promise<{ token: string; url: string }> {
  const token = gerarTokenResumoRascunho();
  const { error } = await supabase.from("public_rascunho_resumos").insert({
    token,
    empresa_id: empresaId,
    snapshot,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    if (
      error.message.includes("public_rascunho_resumos") ||
      error.code === "PGRST204"
    ) {
      throw new Error(
        "Rode no Supabase o SQL supabase/rascunho-compartilhar.sql para compartilhar links."
      );
    }
    throw new Error(error.message);
  }
  return { token, url: resumoRascunhoPublicUrl(token, origin) };
}
