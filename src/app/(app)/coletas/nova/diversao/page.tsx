import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { NovaColetaDiversaoForm } from "@/components/coletas/diversao/NovaColetaDiversaoForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default async function NovaColetaDiversaoPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  if (!nichosAtivos.includes("diversao")) {
    redirect("/coletas/nova");
  }

  return (
    <Suspense fallback={<LoadingState message="Carregando..." />}>
      <NovaColetaDiversaoForm />
    </Suspense>
  );
}
