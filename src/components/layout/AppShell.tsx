import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { PermissoesProvider } from "./PermissoesProvider";
import { RotaPermissaoGuard } from "./RotaPermissaoGuard";
import { TrialBanner } from "./TrialBanner";
import { TrialAccessBody } from "./TrialAccessBody";
import { SimulacaoTrialBar } from "./SimulacaoTrialBar";
import { MobileMenuProvider } from "./MobileMenuContext";
import { MobileAppMenu } from "./MobileAppMenu";
import { MobileMenuButton } from "./MobileMenuButton";
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
import { LogOut } from "lucide-react";
import { AuditoriaSessaoBeacon } from "@/components/auditoria/AuditoriaSessaoBeacon";
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
            <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0a0e16]/70 px-4 backdrop-blur-md lg:px-6">
              <div className="lg:hidden flex items-center gap-2">
                <MobileMenuButton />
                <span
                  className="text-[16px] text-[#f4efe6]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  OperaRoute
                </span>
              </div>
              <div className="hidden lg:block" />
              <div className="flex items-center gap-3">
                <span className="hidden text-[13px] text-slate-400 sm:block lg:hidden">
                  {profile?.nome}
                </span>
                <form action="/auth/signout" method="post" className="lg:hidden">
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-[#c4a574]"
                    title="Sair"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
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
