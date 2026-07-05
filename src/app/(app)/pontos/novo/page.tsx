import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PontoForm } from "@/components/pontos/PontoForm";
import { emptyPontoFormValues } from "@/lib/pontos/form";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getEmpresa, getProfile } from "@/lib/supabase/server";

export default async function NovoPontoPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pontos" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Novo ponto</h1>
          <p className="text-slate-400 text-sm">Cadastre ponto e equipamentos</p>
        </div>
      </div>

      <PontoForm
        mode="create"
        initial={emptyPontoFormValues}
        showEquipamentos
        nichosAtivos={nichosAtivos}
      />
    </div>
  );
}
