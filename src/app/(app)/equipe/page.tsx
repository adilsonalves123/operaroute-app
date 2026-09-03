import { EquipeClient } from "@/components/equipe/EquipeClient";
import { PremiumPageHeader } from "@/components/layout/PremiumPageHeader";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { getLimiteUsuariosEquipe } from "@/lib/equipe/limits";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";

export default async function EquipePage() {
  const profile = await getProfile();
  const supabase = await createClient();

  if (!profile?.empresa_id) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 pt-6 sm:pt-10">
        <PremiumPageHeader
          title="Equipe"
          subtitle="Gerencie gerentes e operadores da operação"
        />
        <div className="rounded-sm border border-at bg-at-card p-8 text-center text-sm text-at-muted">
          Faça login e conclua a configuração para gerenciar a equipe.
        </div>
      </div>
    );
  }

  const [empresa, { data: membros }] = await Promise.all([
    getEmpresa(profile.empresa_id),
    supabase
      .from("equipe")
      .select("*")
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
  ]);

  const limiteUsuarios = getLimiteUsuariosEquipe(empresa?.limite_usuarios);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pt-6 sm:pt-10">
      <PremiumPageHeader
        title="Equipe"
        subtitle="Adicione gerentes, operadores e visualizadores. Defina o que cada um pode ver e fazer."
      />
      <EquipeClient
        membros={membros ?? []}
        limiteUsuarios={limiteUsuarios}
        loginDisponivel={isAdminConfigured()}
        podeGerenciarEquipe={acesso.podeGerenciarEquipe}
      />
    </div>
  );
}
