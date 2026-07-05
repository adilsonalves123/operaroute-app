import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TrialBanner } from "./TrialBanner";
import { getProfile, getEmpresa } from "@/lib/supabase/server";
import { LogOut } from "lucide-react";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;

  return (
    <div className="flex min-h-screen">
      <AppSidebar nomeOperacao={empresa?.nome_operacao ?? profile?.nome_operacao ?? undefined} />
      <div className="flex flex-1 flex-col min-w-0">
        <TrialBanner
          trialFim={profile?.trial_fim ?? null}
          assinaturaAtiva={profile?.assinatura_ativa ?? false}
        />
        <header className="flex h-14 items-center justify-between border-b border-blue-500/10 px-4 lg:px-6">
          <div className="lg:hidden flex items-center gap-2">
            <span className="font-bold text-white">
              Opera<span className="text-primary-neon">Route</span>
            </span>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">
              {profile?.nome}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
