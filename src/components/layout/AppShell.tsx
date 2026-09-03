import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { PermissoesProvider } from "./PermissoesProvider";
import { RotaPermissaoGuard } from "./RotaPermissaoGuard";
import { TrialBanner } from "./TrialBanner";
import { TrialAccessBody } from "./TrialAccessBody";
import { SimulacaoTrialBar } from "./SimulacaoTrialBar";
import { MobileMenuProvider } from "./MobileMenuContext";
import { MobileAppMenu } from "./MobileAppMenu";
import { AppHeader } from "./AppHeader";
import { getAcessoUsuario, type AcessoUsuario } from "@/lib/equipe/acesso";
import { fetchChamadosAbertosResumo } from "@/lib/chamados/fetch-resumo";
import { mesclarPermissoes } from "@/lib/equipe/permissions";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";
import {
  buildAcessoAssinaturaInput,
  trialExpirado,
} from "@/lib/assinatura-acesso";
import { resolverOwnerProfileAcesso } from "@/lib/assinatura-owner";
import { resumoTrialPorFaixa } from "@/lib/onboarding/trial-resumo";
import {
  COOKIE_SIMULAR_TRIAL,
  parseModoSimularTrial,
} from "@/lib/assinatura-simulacao";
import { AuditoriaSessaoBeacon } from "@/components/auditoria/AuditoriaSessaoBeacon";
import { PushNativeInit } from "@/components/push/PushNativeInit";
import { cookies } from "next/headers";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, supabase, empresa } = await getAppBootstrap();
  const cookieStore = await cookies();
  const simulandoTrialExpirado =
    parseModoSimularTrial(cookieStore.get(COOKIE_SIMULAR_TRIAL)?.value) ===
    "expirado";

  let acesso: AcessoUsuario = {
    role: "admin" as const,
    isOwner: true,
    permissoes: mesclarPermissoes("admin", null),
    overrides: null,
    podeGerenciarEquipe: true,
    podeGerenciarRotas: true,
    comissaoPercentual: 0,
  };
  let chamadosAbertos = 0;

  if (profile?.empresa_id) {
    const [acessoResult, chamadosResumo] = await Promise.all([
      getAcessoUsuario(supabase, profile, empresa?.owner_id),
      fetchChamadosAbertosResumo(profile.empresa_id),
    ]);
    acesso = acessoResult;
    chamadosAbertos = chamadosResumo.total;
  }

  const ownerProfileAcesso = await resolverOwnerProfileAcesso(
    profile,
    empresa?.owner_id
  );

  let acessoAssinatura = buildAcessoAssinaturaInput(ownerProfileAcesso, empresa);

  if (simulandoTrialExpirado) {
    acessoAssinatura = {
      ...acessoAssinatura,
      assinatura_ativa: false,
      trial_fim: new Date(Date.now() - 60_000).toISOString(),
      assinatura_vence_em: null,
    };
  }

  const bloqueado = trialExpirado(acessoAssinatura);
  const trialResumo = resumoTrialPorFaixa(
    empresa?.quantidade_pontos,
    (empresa?.pesquisa_onboarding?.nichos_interesse as never) ?? []
  );
  const nomeOperacao =
    empresa?.nome_operacao ?? profile?.nome_operacao ?? undefined;

  return (
    <PermissoesProvider
      role={acesso.role}
      isOwner={acesso.isOwner}
      permissoes={acesso.permissoes}
      comissaoPercentual={acesso.comissaoPercentual}
      rascunhoDashboardAtivo={Boolean(empresa?.rascunho_dashboard_ativo)}
    >
      <MobileMenuProvider>
        <AuditoriaSessaoBeacon />
        <RotaPermissaoGuard />
        <div className="flex min-h-screen">
          <AppSidebar
            nomeOperacao={nomeOperacao}
            chamadosAbertos={chamadosAbertos}
            nomeUsuario={profile?.nome ?? undefined}
          />
          <div className="flex flex-1 flex-col min-w-0">
            {simulandoTrialExpirado && <SimulacaoTrialBar />}
            <TrialBanner
              acesso={acessoAssinatura}
              planoNome={trialResumo.planoNome}
              limitesLabel={`${trialResumo.labelPontos} · ${trialResumo.labelNichos}`}
            />
            <AppHeader nomeUsuario={profile?.nome ?? undefined} />
            <main className="app-shell-main flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
              <PushNativeInit />
              <TrialAccessBody bloqueado={bloqueado}>{children}</TrialAccessBody>
            </main>
            <BottomNav />
          </div>
        </div>
        <MobileAppMenu
          nomeOperacao={nomeOperacao}
          chamadosAbertos={chamadosAbertos}
        />
      </MobileMenuProvider>
    </PermissoesProvider>
  );
}
