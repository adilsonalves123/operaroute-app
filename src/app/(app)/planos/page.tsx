import { resolveNichosAtivos } from "@/lib/assinatura";
import { NICHOS_PAGOS, normalizeFaixaPontos } from "@/lib/pricing";
import { getEmpresa, getProfile } from "@/lib/supabase/server";
import type { Nicho } from "@/lib/types/database";
import { PlanosCalculator } from "./PlanosCalculator";

export default async function PlanosPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const pagosAtivos = nichosAtivos.filter((n) => NICHOS_PAGOS.includes(n));
  const initialNichos: Nicho[] =
    pagosAtivos.length > 0 ? pagosAtivos : (["maquinas_cassino"] as Nicho[]);

  return (
    <PlanosCalculator
      initialFaixa={normalizeFaixaPontos(empresa?.quantidade_pontos)}
      initialNichos={initialNichos}
    />
  );
}
