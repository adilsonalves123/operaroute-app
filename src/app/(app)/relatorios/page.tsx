import { createClient, getProfile } from "@/lib/supabase/server";
import { RelatoriosClient } from "@/components/relatorios/RelatoriosClient";

export default async function RelatoriosPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: relatorios } = profile?.empresa_id
    ? await supabase
        .from("relatorios_coleta")
        .select("*, pontos(nome)")
        .eq("empresa_id", profile.empresa_id)
        .eq("previa", false)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatórios de coleta</h1>
        <p className="text-slate-400 mt-1">Imagens geradas após cada visita cassino</p>
      </div>
      <RelatoriosClient relatorios={relatorios ?? []} />
    </div>
  );
}
