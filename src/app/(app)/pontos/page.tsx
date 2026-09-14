import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { PontosClient } from "./PontosClient";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { aplicarFiltroIdsPontos, resolverVisaoOperador } from "@/lib/visao/resolver";
import type { Ponto } from "@/lib/types/database";

/** Só o que o card da lista usa — JSON pesado (estoque_brindes) derruba o select e a tela fica vazia. */
const COLUNAS_LISTA =
  "id, empresa_id, nome, cidade, bairro, status, foto_url, ultima_coleta, created_at";

export default async function PontosPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  if (!profile?.empresa_id) {
    return <PontosClient pontos={[]} />;
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const visao = await resolverVisaoOperador(supabase, acesso);
  const visaoLista = acesso.isOwner ? { ...visao, restrita: false } : visao;

  const query = aplicarFiltroIdsPontos(
    supabase
      .from("pontos")
      .select(COLUNAS_LISTA)
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
    visaoLista
  );

  let { data: pontos, error } = await query;

  if (error) {
    const fallback = aplicarFiltroIdsPontos(
      supabase
        .from("pontos")
        .select("id, nome, cidade, status, foto_url, ultima_coleta")
        .eq("empresa_id", profile.empresa_id)
        .order("nome"),
      visaoLista
    );
    const retry = await fallback;
    pontos = retry.data as typeof pontos;
    error = retry.error;
  }

  return (
    <PontosClient
      pontos={(pontos ?? []) as Ponto[]}
      erroCarregar={error?.message ?? null}
    />
  );
}
