import { redirect } from "next/navigation";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";
import { resolverVisaoOperador } from "@/lib/visao/resolver";

/** Páginas com números reais da casa — operador em visão vai para o painel publicado. */
export async function redirectSeVisaoRestrita(destino = "/dashboard") {
  const { profile, supabase, empresa } = await getAppBootstrap();
  if (!profile?.empresa_id) return;
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const visao = await resolverVisaoOperador(supabase, acesso);
  if (visao.restrita) redirect(destino);
}
