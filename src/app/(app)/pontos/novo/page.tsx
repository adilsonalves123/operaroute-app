import { PontoForm } from "@/components/pontos/PontoForm";
import { PontoFormPageShell } from "@/components/pontos/PontoFormPageShell";
import { emptyPontoFormValues } from "@/lib/pontos/form";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getEmpresa, getProfile } from "@/lib/supabase/server";

export default async function NovoPontoPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  return (
    <PontoFormPageShell title="Novo ponto" subtitle="Cadastre ponto e equipamentos">
      <PontoForm
        mode="create"
        initial={emptyPontoFormValues}
        showEquipamentos
        nichosAtivos={nichosAtivos}
      />
    </PontoFormPageShell>
  );
}
