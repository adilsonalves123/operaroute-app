import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { NovaColetaFuraFuraForm } from "@/components/coletas/fura-fura/NovaColetaFuraFuraForm";

export default async function NovaColetaFuraFuraPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  if (!nichosAtivos.includes("fura_fura")) {
    redirect("/coletas/nova");
  }

  return (
    <Suspense fallback={<div className="text-slate-500 p-8">Carregando...</div>}>
      <NovaColetaFuraFuraForm />
    </Suspense>
  );
}
