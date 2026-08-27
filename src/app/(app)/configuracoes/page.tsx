import { getProfile, getEmpresa, createClient } from "@/lib/supabase/server";
import {
  normalizeFaixaPontos,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import type { Nicho } from "@/lib/types/database";
import { buildAcessoAssinaturaInput } from "@/lib/assinatura-acesso";
import { resolverOwnerProfileAcesso } from "@/lib/assinatura-owner";
import { ConfiguracoesClient } from "@/components/configuracoes/ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  const supabase = await createClient();
  const { count: pontosAtivos } = empresa
    ? await supabase
        .from("pontos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresa.id)
        .eq("status", "ativo")
    : { count: 0 };

  let acesso = null;
  if (profile?.empresa_id) {
    acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  }

  const ownerProfileAcesso = await resolverOwnerProfileAcesso(
    profile,
    empresa?.owner_id
  );
  const acessoAssinatura = buildAcessoAssinaturaInput(ownerProfileAcesso, empresa);

  const faixa = normalizeFaixaPontos(empresa?.quantidade_pontos) as FaixaPontos;
  let planosList: PlanoDefinicao[] | undefined;
  if (empresa && isAdminConfigured()) {
    try {
      const precos = await loadPrecosPayload(createAdminClient());
      planosList = precos.planos;
    } catch {
      // keep default
    }
  }

  const podeCancelar = Boolean(acesso?.isOwner || acesso?.role === "admin");

  return (
    <ConfiguracoesClient
      nomeOperacao={empresa?.nome_operacao ?? profile?.nome_operacao ?? ""}
      nomeResponsavel={profile?.nome ?? ""}
      email={profile?.email ?? null}
      whatsapp={profile?.whatsapp ?? null}
      chavePix={empresa?.chave_pix ?? null}
      faixa={faixa}
      nichosAtivos={nichosAtivos as Nicho[]}
      pontosAtivos={pontosAtivos ?? 0}
      planos={planosList}
      acesso={acessoAssinatura}
      podeCancelar={podeCancelar}
      podeZerar={podeCancelar}
      temCassino={nichosAtivos.includes("maquinas_cassino")}
      rascunhoDashboardAtivo={Boolean(empresa?.rascunho_dashboard_ativo)}
      podeEditarRascunho={podeCancelar}
    />
  );
}
