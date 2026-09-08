import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { PendenciasClient, type PendenciaItem } from "@/components/pendencias/PendenciasClient";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { aplicarFiltroIdsPontos, resolverVisaoOperador } from "@/lib/visao/resolver";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function PendenciasPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  let pendencias: PendenciaItem[] = [];

  if (profile?.empresa_id) {
    const empresa = await getEmpresa(profile.empresa_id);
    const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
    const visao = await resolverVisaoOperador(supabase, acesso);
    const query = aplicarFiltroIdsPontos(
      supabase
        .from("pendencias")
        .select("*, pontos(nome, whatsapp)")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false })
        .limit(2000),
      visao,
      "ponto_id"
    );
    const { data } = await query;
    pendencias = (data ?? []) as PendenciaItem[];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Pendências</h1>
          <p className="mt-1 text-base text-slate-400">
            Débitos e pagamentos em aberto por ponto
          </p>
        </div>
        <Link
          href="/pendencias/nova"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2.5 text-sm font-medium text-primary-neon hover:bg-blue-500/10"
        >
          <Plus className="h-4 w-4" />
          Nova pendência
        </Link>
      </div>
      <PendenciasClient pendencias={pendencias} />
    </div>
  );
}
