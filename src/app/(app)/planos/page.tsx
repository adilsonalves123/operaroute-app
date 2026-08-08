import { resolveNichosAtivos } from "@/lib/assinatura";
import { NICHOS_PAGOS, normalizeFaixaPontos } from "@/lib/pricing";
import { getEmpresa, getProfile, createClient } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import type { Nicho } from "@/lib/types/database";
import { PlanosCalculator } from "./PlanosCalculator";
import { PlanosShell } from "./PlanosShell";
import { buildAcessoAssinaturaInput, temPagamentoValido } from "@/lib/assinatura-acesso";
import { resolverOwnerProfileAcesso } from "@/lib/assinatura-owner";
import { CancelarAssinaturaCard } from "@/components/configuracoes/CancelarAssinaturaCard";

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{
    adicionar?: string;
    billing?: string;
    checkout?: string;
  }>;
}) {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const pagosAtivos = nichosAtivos.filter((n) => NICHOS_PAGOS.includes(n));
  const initialNichos: Nicho[] =
    pagosAtivos.length > 0 ? pagosAtivos : (["maquinas_cassino"] as Nicho[]);

  const supabase = await createClient();
  let acesso = null;
  if (profile?.empresa_id) {
    acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  }

  const ownerProfileAcesso = await resolverOwnerProfileAcesso(
    profile,
    empresa?.owner_id
  );
  const acessoAssinatura = buildAcessoAssinaturaInput(ownerProfileAcesso, empresa);
  const pagamentoOk = temPagamentoValido(acessoAssinatura);

  const { adicionar, billing, checkout } = await searchParams;
  const preselectNicho =
    adicionar && NICHOS_PAGOS.includes(adicionar as Nicho)
      ? (adicionar as Nicho)
      : undefined;

  const billingStatus =
    billing === "success" || billing === "failure" || billing === "pending"
      ? billing
      : null;

  const podeCancelar = Boolean(acesso?.isOwner || acesso?.role === "admin");

  return (
    <PlanosShell>
      <PlanosCalculator
        initialFaixa={normalizeFaixaPontos(empresa?.quantidade_pontos)}
        initialNichos={initialNichos}
        nichosTravados={pagosAtivos}
        preselectNicho={preselectNicho}
        assinaturaAtiva={pagamentoOk}
        billingStatus={billingStatus}
        billingCheckoutId={checkout ?? null}
      />
      <div className="mt-8 max-w-2xl">
        <CancelarAssinaturaCard
          acesso={acessoAssinatura}
          podeCancelar={podeCancelar}
        />
      </div>
    </PlanosShell>
  );
}
