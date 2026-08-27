import { redirect } from "next/navigation";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { DashboardRascunhoClient } from "@/components/rascunho/DashboardRascunhoClient";

export default async function RascunhoPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;

  if (!empresa?.rascunho_dashboard_ativo) {
    redirect("/dashboard");
  }

  if (!profile?.empresa_id) {
    return <DashboardRascunhoClient pontos={[]} />;
  }

  const { data: pontos } = await supabase
    .from("pontos")
    .select("id, nome, status")
    .eq("empresa_id", profile.empresa_id)
    .order("nome");

  return <DashboardRascunhoClient pontos={pontos ?? []} />;
}
