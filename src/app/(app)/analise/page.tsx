import { getProfile, getEmpresa, createClient } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchInteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { AnalisePremiumClient } from "@/components/analise/AnalisePremiumClient";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import {
  fetchComissaoStaffPeriodo,
  filtrarComissaoStaffParaViewer,
} from "@/lib/equipe/comissao-staff-periodo";

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
  let comissaoStaff: {
    total: number;
    totalVales: number;
    totalAPagar: number;
    linhas: {
      nome: string;
      percentual: number;
      valor: number;
      vales: number;
      aPagar: number;
    }[];
  } | null = null;

  if (profile?.empresa_id) {
    const supabase = await createClient();
    const empresaRow = empresa;
    const [intel, acesso, rawComissao] = await Promise.all([
      fetchInteligenciaOperacional(supabase, profile.empresa_id, {
        cassino: isCassino,
        furaFura: isFuraFura,
        ursinho: isUrsinho,
        diversao: isDiversao,
        bolinha: isBolinha,
        consignado: isConsignado,
        periodo,
      }),
      getAcessoUsuario(supabase, profile, empresaRow?.owner_id),
      fetchComissaoStaffPeriodo(
        supabase,
        profile.empresa_id,
        periodo.inicioISO,
        periodo.fimISO
      ),
    ]);
    data = intel;
    const visivel = filtrarComissaoStaffParaViewer(rawComissao, {
      userId: profile.user_id,
      isOwner: acesso.isOwner,
      role: acesso.role,
    });
    if (visivel.linhas.length > 0) {
      comissaoStaff = {
        total: visivel.total,
        totalVales: visivel.totalVales,
        totalAPagar: visivel.totalAPagar,
        linhas: visivel.linhas.map((l) => ({
          nome: l.nome,
          percentual: l.percentual,
          valor: l.valor,
          vales: l.vales,
          aPagar: l.aPagar,
        })),
      };
    }
  }

  if (!data) {
    return (
      <p className="px-4 py-16 text-center text-sm text-slate-500">
        Faça login para ver a análise.
      </p>
    );
  }

  return <AnalisePremiumClient data={data} periodo={periodo} comissaoStaff={comissaoStaff} />;
}
