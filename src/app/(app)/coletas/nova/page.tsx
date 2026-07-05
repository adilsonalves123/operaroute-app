import { redirect } from "next/navigation";
import { getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { NovaColetaLegacyForm } from "@/components/coletas/NovaColetaLegacyForm";
import { EscolherNovaColeta } from "@/components/coletas/EscolherNovaColeta";

export default async function NovaColetaPage({
  searchParams,
}: {
  searchParams: Promise<{ ponto?: string }>;
}) {
  const { ponto } = await searchParams;
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");

  if (isCassino && isFuraFura) {
    return <EscolherNovaColeta pontoId={ponto} />;
  }

  if (isCassino) {
    redirect(ponto ? `/coletas/nova/cassino?ponto=${ponto}` : "/coletas/nova/cassino");
  }

  if (isFuraFura) {
    redirect(ponto ? `/coletas/nova/fura-fura?ponto=${ponto}` : "/coletas/nova/fura-fura");
  }

  return <NovaColetaLegacyForm />;
}
