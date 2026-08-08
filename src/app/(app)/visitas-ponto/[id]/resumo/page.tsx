import { notFound } from "next/navigation";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchComissaoEquipePorUserId } from "@/lib/equipe/fetch-comissao";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { fetchVisitaPontoResumo, resolveNichosVisitaPonto } from "@/lib/visitas-ponto";
import {
  fetchCassinoVisitaIdsVisitaPonto,
  totalDividaAnteriorPonto,
} from "@/lib/visitas-ponto/divida-ponto";
import { fetchHaverSaldoPonto } from "@/lib/coletas/haver-nicho";
import { VisitaPontoResumoView } from "@/components/visitas-ponto/VisitaPontoResumoView";

export default async function VisitaPontoResumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) notFound();

  const supabase = await createClient();
  const resumo = await fetchVisitaPontoResumo(supabase, profile.empresa_id, id);
  if (!resumo || resumo.status === "cancelada") notFound();

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const nichosDisponiveis = resolveNichosVisitaPonto(nichosAtivos);

  const cassinoVisitaIds = await fetchCassinoVisitaIdsVisitaPonto(supabase, id);

  const [{ data: ponto }, dividaSaldo, haverSaldo, acesso, comissaoOperador] = await Promise.all([
    supabase.from("pontos").select("whatsapp").eq("id", resumo.pontoId).maybeSingle(),
    totalDividaAnteriorPonto(supabase, profile.empresa_id, resumo.pontoId, {
      excluirVisitaPontoId: id,
      excluirVisitaIds: cassinoVisitaIds,
    }),
    fetchHaverSaldoPonto(supabase, profile.empresa_id, resumo.pontoId),
    getAcessoUsuario(supabase, profile, empresa?.owner_id),
    fetchComissaoEquipePorUserId(
      supabase,
      profile.empresa_id,
      resumo.operadorId ?? profile.user_id
    ),
  ]);

  const comissaoStaffPercentual =
    comissaoOperador > 0 ? comissaoOperador : acesso.comissaoPercentual;

  return (
    <VisitaPontoResumoView
      resumo={resumo}
      dividaSaldo={dividaSaldo}
      haverSaldo={haverSaldo}
      pontoWhatsapp={ponto?.whatsapp ?? null}
      chavePix={empresa?.chave_pix ?? null}
      nomeOperacao={empresa?.nome_operacao ?? null}
      nichosDisponiveis={nichosDisponiveis}
      comissaoStaffPercentual={comissaoStaffPercentual}
    />
  );
}
