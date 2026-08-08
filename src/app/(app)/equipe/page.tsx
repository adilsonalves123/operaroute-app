import { EquipeClient } from "@/components/equipe/EquipeClient";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { getLimiteUsuariosEquipe } from "@/lib/equipe/limits";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";

export default async function EquipePage() {
  const profile = await getProfile();
  const supabase = await createClient();

  if (!profile?.empresa_id) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipe</h1>
          <p className="text-slate-400 mt-1">Gerencie gerentes e operadores da operação</p>
        </div>
        <div className="glass-card p-8 text-center text-sm text-slate-500">
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Equipe</h1>
        <p className="text-slate-400 mt-1">
          Adicione gerentes, operadores e visualizadores. Defina o que cada um pode ver e fazer.
        </p>
      </div>
      <EquipeClient
        membros={membros ?? []}
        limiteUsuarios={limiteUsuarios}
        loginDisponivel={isAdminConfigured()}
        podeGerenciarEquipe={acesso.podeGerenciarEquipe}
      />
    </div>
  );
}
