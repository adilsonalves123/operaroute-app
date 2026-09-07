import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import {
  mesclarPermissoes,
  normalizarOverrides,
  pode,
  podeGerenciarRotasPermissao,
  type PermissaoAcao,
  type PermissaoModulo,
  type PermissoesOverrides,
  type PermissoesResolvidas,
} from "@/lib/equipe/permissions";
import { clampComissaoPercentual } from "@/lib/equipe/comissao-staff";
import type { Profile, UserRole } from "@/lib/types/database";

export type AcessoUsuario = {
  role: UserRole;
  isOwner: boolean;
  permissoes: PermissoesResolvidas;
  overrides: PermissoesOverrides | null;
  podeGerenciarEquipe: boolean;
  /** Montar/enviar rotas — baseado em rotas.criar|editar (padrão do gerente já inclui). */
  podeGerenciarRotas: boolean;
  /** % da Equipe sobre lucro após brindes (0 se dono sem linha em equipe). */
  comissaoPercentual: number;
  equipeId: string | null;
  /** Painel/lista/pontos só com o que o admin publicar. Coleta real continua. */
  visaoRestrita: boolean;
};

export const getAcessoUsuario = cache(async (
  supabase: SupabaseClient,
  profile: Profile,
  ownerId?: string | null
): Promise<AcessoUsuario> => {
  const isOwner = Boolean(ownerId && ownerId === profile.user_id);

  if (isOwner) {
    const { data: membroOwner } = await supabase
      .from("equipe")
      .select("id, comissao_percentual")
      .eq("empresa_id", profile.empresa_id!)
      .eq("user_id", profile.user_id)
      .maybeSingle();
    const permissoes = mesclarPermissoes("admin", null);
    return {
      role: "admin",
      isOwner: true,
      permissoes,
      overrides: null,
      podeGerenciarEquipe: true,
      podeGerenciarRotas: true,
      comissaoPercentual: clampComissaoPercentual(membroOwner?.comissao_percentual),
      equipeId: membroOwner?.id ?? null,
      visaoRestrita: false,
    };
  }

  let { data: membro, error: membroErr } = await supabase
    .from("equipe")
    .select("id, role, permissoes, comissao_percentual, visao_restrita")
    .eq("empresa_id", profile.empresa_id!)
    .eq("user_id", profile.user_id)
    .maybeSingle();

  if (membroErr) {
    const fallback = await supabase
      .from("equipe")
      .select("id, role, permissoes, comissao_percentual")
      .eq("empresa_id", profile.empresa_id!)
      .eq("user_id", profile.user_id)
      .maybeSingle();
    membro = fallback.data
      ? { ...fallback.data, visao_restrita: false }
      : null;
  }

  const role = (membro?.role as UserRole) ?? "operador";
  const overrides = normalizarOverrides(membro?.permissoes);
  const permissoes = mesclarPermissoes(role, overrides);

  return {
    role,
    isOwner: false,
    permissoes,
    overrides,
    podeGerenciarEquipe: role === "admin" || role === "gerente",
    podeGerenciarRotas: podeGerenciarRotasPermissao(permissoes),
    comissaoPercentual: clampComissaoPercentual(membro?.comissao_percentual),
    equipeId: membro?.id ?? null,
    visaoRestrita: Boolean(membro?.visao_restrita),
  };
});

export function usuarioPode(
  acesso: AcessoUsuario,
  modulo: PermissaoModulo,
  acao: PermissaoAcao
): boolean {
  if (acesso.isOwner) return true;
  return pode(acesso.permissoes, modulo, acao);
}
