import { redirect } from "next/navigation";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { DashboardRascunhoClient } from "@/components/rascunho/DashboardRascunhoClient";
import { redirectSeVisaoRestrita } from "@/lib/visao/bloquear-historico";

export default async function RascunhoPage() {
  await redirectSeVisaoRestrita("/dashboard");
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;

  if (!empresa?.rascunho_dashboard_ativo) {
    redirect("/dashboard");
  }

  const empresaNome = empresa?.nome_operacao?.trim() || "Operação";

  if (!profile?.empresa_id) {
    return <DashboardRascunhoClient pontos={[]} empresaNome={empresaNome} operadoresVisao={[]} />;
  }

  const [{ data: pontos }, { data: operadores }] = await Promise.all([
    supabase
      .from("pontos")
      .select("id, nome, status")
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
    supabase
      .from("equipe")
      .select("id, nome")
      .eq("empresa_id", profile.empresa_id)
      .eq("visao_restrita", true)
      .eq("status", "ativo")
      .order("nome"),
  ]);

  return (
    <DashboardRascunhoClient
      pontos={pontos ?? []}
      empresaNome={empresaNome}
      operadoresVisao={operadores ?? []}
    />
  );
}
