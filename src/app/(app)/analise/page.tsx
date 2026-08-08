import { getProfile, getEmpresa, createClient } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchInteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { AnalisePremiumClient } from "@/components/analise/AnalisePremiumClient";

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { periodo: periodoRaw, de, ate } = await searchParams;
  const periodo = resolverPeriodoAnalise({ periodo: periodoRaw, de, ate });
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isUrsinho =
    nichosAtivos.includes("ursinho") || nichosAtivos.includes("vending_ursinho");
  const isDiversao = nichosAtivos.includes("diversao");
  const isBolinha = nichosAtivos.includes("bolinha");
  const isConsignado = nichosAtivos.includes("consignado");

  let data = null;

  if (profile?.empresa_id) {
    const supabase = await createClient();
    data = await fetchInteligenciaOperacional(supabase, profile.empresa_id, {
      cassino: isCassino,
      furaFura: isFuraFura,
      ursinho: isUrsinho,
      diversao: isDiversao,
      bolinha: isBolinha,
      consignado: isConsignado,
      periodo,
    });
  }

  if (!data) {
    return (
      <p className="px-4 py-16 text-center text-sm text-slate-500">
        Faça login para ver a análise.
      </p>
    );
  }

  return <AnalisePremiumClient data={data} periodo={periodo} />;
}
