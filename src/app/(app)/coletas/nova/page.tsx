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
  const isUrsinho =
    nichosAtivos.includes("ursinho") || nichosAtivos.includes("vending_ursinho");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isDiversao = nichosAtivos.includes("diversao");
  const isBolinha = nichosAtivos.includes("bolinha");
  const isConsignado = nichosAtivos.includes("consignado");
  const modulosEspecificos = [
    isCassino,
    isUrsinho,
    isFuraFura,
    isDiversao,
    isBolinha,
    isConsignado,
  ].filter(Boolean).length;

  if (modulosEspecificos > 1) {
    return <EscolherNovaColeta pontoId={ponto} nichosAtivos={nichosAtivos} />;
  }

  if (isCassino) {
    redirect(ponto ? `/coletas/nova/cassino?ponto=${ponto}` : "/coletas/nova/cassino");
  }

  if (isUrsinho) {
    redirect(ponto ? `/coletas/nova/ursinho?ponto=${ponto}` : "/coletas/nova/ursinho");
  }

  if (isFuraFura) {
    redirect(ponto ? `/coletas/nova/fura-fura?ponto=${ponto}` : "/coletas/nova/fura-fura");
  }

  if (isDiversao) {
    redirect(ponto ? `/coletas/nova/diversao?ponto=${ponto}` : "/coletas/nova/diversao");
  }

  if (isBolinha) {
    redirect(ponto ? `/coletas/nova/bolinha?ponto=${ponto}` : "/coletas/nova/bolinha");
  }

  if (isConsignado) {
    redirect(ponto ? `/coletas/nova/consignado?ponto=${ponto}` : "/coletas/nova/consignado");
  }

  return <NovaColetaLegacyForm />;
}
