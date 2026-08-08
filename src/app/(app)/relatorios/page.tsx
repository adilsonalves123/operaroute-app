import { after } from "next/server";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { RelatoriosMultiNichoTabs } from "@/components/relatorios/RelatoriosMultiNichoTabs";
import { RelatoriosRetencaoPanel } from "@/components/relatorios/RelatoriosRetencaoPanel";
import { type RelatorioItem } from "@/components/relatorios/RelatoriosClient";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import { NICHO_MODULO_URSINHO } from "@/lib/nichos/ursinho";
import { NICHO_MODULO_DIVERSAO } from "@/lib/nichos/diversao";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import {
  dashboardNichosLabel,
  getDashboardNichosAtivos,
  isDashboardMultiNicho,
} from "@/lib/dashboard-nichos-ativos";
import {
  limparMidiaAntigaEmpresa,
  normalizarRetencaoMidiaDias,
} from "@/lib/relatorios/retencao";

export default async function RelatoriosPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const dashboardNichos = getDashboardNichosAtivos(nichosAtivos);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isUrsinho = nichosAtivos.includes("ursinho");
  const isDiversao = nichosAtivos.includes("diversao");
  const isBolinha = nichosAtivos.includes("bolinha");
  const isMulti = isDashboardMultiNicho(nichosAtivos);

  const supabase = await createClient();
  const acesso = profile?.empresa_id
    ? await getAcessoUsuario(supabase, profile, empresa?.owner_id)
    : null;
  const podeGerir = Boolean(acesso?.podeGerenciarEquipe || acesso?.isOwner);
  const retencaoDias = normalizarRetencaoMidiaDias(empresa?.retencao_midia_dias);

  let desdeIso: string | null = null;
  if (retencaoDias > 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - retencaoDias);
    desdeIso = d.toISOString();
  }

  if (profile?.empresa_id && retencaoDias > 0) {
    const empresaId = profile.empresa_id;
    after(async () => {
      try {
        const sb = await createClient();
        await limparMidiaAntigaEmpresa(sb, empresaId, retencaoDias);
      } catch {
        // background
      }
    });
  }

  const empty = Promise.resolve({ data: [] as unknown[] });

  const cassinoQ = isCassino
    ? (() => {
        let q = supabase
          .from("relatorios_coleta")
          .select("*, pontos(nome)")
          .eq("empresa_id", profile!.empresa_id!)
          .eq("previa", false)
          .order("created_at", { ascending: false })
          .limit(50);
        if (desdeIso) q = q.gte("created_at", desdeIso);
        return q;
      })()
    : empty;

  const furaQ = isFuraFura
    ? (() => {
        let q = supabase
          .from("coletas")
          .select(
            "id, foto_url, created_at, lucro_real, valor_liquido, quantidade_furos, pontos(nome)"
          )
          .eq("empresa_id", profile!.empresa_id!)
          .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
          .not("foto_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (desdeIso) q = q.gte("created_at", desdeIso);
        return q;
      })()
    : empty;

  const ursinhoQ = isUrsinho
    ? (() => {
        let q = supabase
          .from("coletas")
          .select("id, foto_url, created_at, lucro_real, valor_liquido, pontos(nome)")
          .eq("empresa_id", profile!.empresa_id!)
          .eq("nicho_modulo", NICHO_MODULO_URSINHO)
          .not("foto_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (desdeIso) q = q.gte("created_at", desdeIso);
        return q;
      })()
    : empty;

  const diversaoQ = isDiversao
    ? (() => {
        let q = supabase
          .from("coletas")
          .select("id, foto_url, created_at, lucro_real, valor_liquido, pontos(nome)")
          .eq("empresa_id", profile!.empresa_id!)
          .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
          .not("foto_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (desdeIso) q = q.gte("created_at", desdeIso);
        return q;
      })()
    : empty;

  const bolinhaQ = isBolinha
    ? (() => {
        let q = supabase
          .from("coletas")
          .select("id, foto_url, created_at, lucro_real, valor_liquido, pontos(nome)")
          .eq("empresa_id", profile!.empresa_id!)
          .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
          .not("foto_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (desdeIso) q = q.gte("created_at", desdeIso);
        return q;
      })()
    : empty;

  const [
    { data: relatorios },
    { data: coletasFura },
    { data: coletasUrsinho },
    { data: coletasDiversao },
    { data: coletasBolinha },
  ] = profile?.empresa_id
    ? await Promise.all([cassinoQ, furaQ, ursinhoQ, diversaoQ, bolinhaQ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const subtitle = isMulti
    ? `Relatórios ${dashboardNichosLabel(dashboardNichos).toLowerCase()}`
    : isFuraFura
      ? "Fotos e histórico das coletas fura-fura"
      : isUrsinho
        ? "Fotos e histórico das coletas ursinho"
        : isDiversao
          ? "Fotos e histórico das coletas de diversão"
          : isBolinha
            ? "Fotos e histórico das coletas de bolinha"
            : "Imagens geradas após cada visita cassino";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatórios de coleta</h1>
        <p className="mt-1 text-slate-400">{subtitle}</p>
      </div>

      <RelatoriosRetencaoPanel retencaoDias={retencaoDias} podeGerir={podeGerir} />

      <RelatoriosMultiNichoTabs
        nichos={dashboardNichos}
        cassino={(relatorios ?? []) as unknown as RelatorioItem[]}
        furaColetas={
          (coletasFura ?? []) as unknown as import("@/components/relatorios/RelatoriosMultiNichoTabs").ColetaFotoRelatorio[]
        }
        ursinhoColetas={
          (coletasUrsinho ?? []) as unknown as import("@/components/relatorios/RelatoriosMultiNichoTabs").ColetaFotoRelatorio[]
        }
        diversaoColetas={
          (coletasDiversao ?? []) as unknown as import("@/components/relatorios/RelatoriosMultiNichoTabs").ColetaFotoRelatorio[]
        }
        bolinhaColetas={
          (coletasBolinha ?? []) as unknown as import("@/components/relatorios/RelatoriosMultiNichoTabs").ColetaFotoRelatorio[]
        }
        podeApagar={podeGerir}
      />
    </div>
  );
}
