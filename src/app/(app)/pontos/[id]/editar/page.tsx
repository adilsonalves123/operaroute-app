import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EditarPontoForm } from "@/components/pontos/EditarPontoForm";
import { PontoFormPageShell } from "@/components/pontos/PontoFormPageShell";
import { resolveNichosAtivos } from "@/lib/assinatura";

export default async function EditarPontoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  const { data: ponto } = await supabase
    .from("pontos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .single();

  if (!ponto) notFound();

  return (
    <PontoFormPageShell
      title="Editar ponto"
      subtitle={ponto.nome}
      backHref={`/pontos/${id}`}
    >
      <EditarPontoForm
        pontoId={id}
        nichosAtivos={nichosAtivos}
        ponto={{
          nome: ponto.nome,
          responsavel: ponto.responsavel,
          whatsapp: ponto.whatsapp,
          cidade: ponto.cidade,
          bairro: ponto.bairro,
          endereco: ponto.endereco,
          latitude: ponto.latitude,
          longitude: ponto.longitude,
          status: ponto.status,
          comissao_percentual: ponto.comissao_percentual,
          comissao_por_nicho: ponto.comissao_por_nicho,
          consignado_modo_comissao: ponto.consignado_modo_comissao,
          observacoes: ponto.observacoes,
          foto_url: ponto.foto_url,
        }}
      />
    </PontoFormPageShell>
  );
}
