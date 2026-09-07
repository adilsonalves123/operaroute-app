import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { PontosClient } from "./PontosClient";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { aplicarFiltroIdsPontos, resolverVisaoOperador } from "@/lib/visao/resolver";

export default async function PontosPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  if (!profile?.empresa_id) {
    return <PontosClient pontos={[]} />;
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const visao = await resolverVisaoOperador(supabase, acesso);

  const query = aplicarFiltroIdsPontos(
    supabase
      .from("pontos")
      .select(
        "id, empresa_id, nome, responsavel, whatsapp, cidade, bairro, endereco, latitude, longitude, tipo_ponto, status, comissao_percentual, operador_id, observacoes, abater_automatico, foto_url, ultima_coleta, created_at, preco_furo, furos_estoque, furos_minimo, estoque_brindes, kit_ativo_id, kit_instalado_em"
      )
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
    visao
  );

  const { data: pontos } = await query;

  // Só a foto cadastrada do ponto (cliente). Foto de coleta não substitui.
  return <PontosClient pontos={pontos ?? []} />;
}
