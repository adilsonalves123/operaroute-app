import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { FuraFuraRotaDiaClient } from "@/components/rotas/FuraFuraRotaDiaClient";
import { ModulePage } from "@/components/layout/ModulePage";

export default async function RotasPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isFuraFura = nichosAtivos.includes("fura_fura");

  if (!isFuraFura || !profile?.empresa_id) {
    return (
      <ModulePage
        title="Rotas"
        description="Planeje e execute visitas do dia"
        emptyTitle="Nenhuma rota criada"
        emptyDescription="Crie uma rota para organizar suas visitas e coletas."
        actionLabel="Nova rota"
        actionHref="#"
      />
    );
  }

  const supabase = await createClient();
  const { data: pontos } = await supabase
    .from("pontos")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .eq("status", "ativo")
    .order("nome");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Rota do dia</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Pontos ordenados por prioridade — sem coleta, furos baixos primeiro
        </p>
      </div>
      <FuraFuraRotaDiaClient pontos={pontos ?? []} />
    </div>
  );
}
