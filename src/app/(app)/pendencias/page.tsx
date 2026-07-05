import { createClient, getProfile } from "@/lib/supabase/server";
import { PendenciasClient } from "@/components/pendencias/PendenciasClient";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function PendenciasPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: pendencias } = profile?.empresa_id
    ? await supabase
        .from("pendencias")
        .select("*, pontos(nome, whatsapp)")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pendências</h1>
          <p className="text-slate-400 mt-1">Débitos negativos e pagamentos pendentes das coletas</p>
        </div>
        <Link
          href="/pendencias/nova"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2.5 text-sm font-medium text-primary-neon hover:bg-blue-500/10"
        >
          <Plus className="h-4 w-4" />
          Nova pendência
        </Link>
      </div>
      <PendenciasClient pendencias={pendencias ?? []} />
    </div>
  );
}
