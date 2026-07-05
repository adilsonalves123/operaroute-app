import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { RelatoriosMultiNichoTabs, type ColetaFuraRelatorio } from "@/components/relatorios/RelatoriosMultiNichoTabs";
import { type RelatorioItem } from "@/components/relatorios/RelatoriosClient";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";

export default async function RelatoriosPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isMulti = isCassino && isFuraFura;

  const supabase = await createClient();

  const [{ data: relatorios }, { data: coletasFura }] = profile?.empresa_id
    ? await Promise.all([
        isCassino
          ? supabase
              .from("relatorios_coleta")
              .select("*, pontos(nome)")
              .eq("empresa_id", profile.empresa_id)
              .eq("previa", false)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
        isFuraFura
          ? supabase
              .from("coletas")
              .select(
                "id, foto_url, created_at, lucro_real, valor_liquido, quantidade_furos, pontos(nome)"
              )
              .eq("empresa_id", profile.empresa_id)
              .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
              .not("foto_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  const subtitle = isMulti
    ? "Relatórios cassino e fotos das coletas fura-fura"
    : isFuraFura
      ? "Fotos e histórico das coletas fura-fura"
      : "Imagens geradas após cada visita cassino";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatórios de coleta</h1>
        <p className="text-slate-400 mt-1">{subtitle}</p>
      </div>
      <RelatoriosMultiNichoTabs
        cassino={(relatorios ?? []) as unknown as RelatorioItem[]}
        furaColetas={(coletasFura ?? []) as unknown as ColetaFuraRelatorio[]}
        showFura={isFuraFura}
      />
    </div>
  );
}
