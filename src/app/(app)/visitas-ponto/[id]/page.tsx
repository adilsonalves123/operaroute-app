import { notFound, redirect } from "next/navigation";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchComissaoEquipePorUserId } from "@/lib/equipe/fetch-comissao";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { fetchVisitaPontoResumo, resolveNichosVisitaPonto } from "@/lib/visitas-ponto";
import {
  fetchCassinoVisitaIdsVisitaPonto,
  totalDividaAnteriorPonto,
} from "@/lib/visitas-ponto/divida-ponto";
import { VisitaPontoHub } from "@/components/visitas-ponto/VisitaPontoHub";

export default async function VisitaPontoPage({
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

  if (resumo.status === "finalizada") {
    redirect(`/visitas-ponto/${id}/resumo`);
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const nichosDisponiveis = resolveNichosVisitaPonto(nichosAtivos);

  const cassinoVisitaIds = await fetchCassinoVisitaIdsVisitaPonto(supabase, id);

  const [dividaSaldo, acesso, comissaoOperador] = await Promise.all([
    totalDividaAnteriorPonto(supabase, profile.empresa_id, resumo.pontoId, {
      excluirVisitaPontoId: id,
      excluirVisitaIds: cassinoVisitaIds,
    }),
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
    <VisitaPontoHub
      resumo={resumo}
      nichosDisponiveis={nichosDisponiveis}
      dividaSaldo={dividaSaldo}
      comissaoStaffPercentual={comissaoStaffPercentual}
    />
  );
}
