import { createClient, getProfile } from "@/lib/supabase/server";
import { DashboardRascunhoClient } from "@/components/rascunho/DashboardRascunhoClient";

export default async function RascunhoPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

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
