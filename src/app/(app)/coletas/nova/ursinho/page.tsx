import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { NovaColetaUrsinhoForm } from "@/components/coletas/ursinho/NovaColetaUrsinhoForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default async function NovaColetaUrsinhoPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  if (
    !nichosAtivos.includes("ursinho") &&
    !nichosAtivos.includes("vending_ursinho")
  ) {
    redirect("/coletas/nova");
  }

  return (
    <Suspense fallback={<LoadingState message="Carregando..." />}>
      <NovaColetaUrsinhoForm />
    </Suspense>
  );
}
