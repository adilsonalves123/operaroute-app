import { createClient, getProfile } from "@/lib/supabase/server";
import { PendenciasClient } from "@/components/pendencias/PendenciasClient";
import { PremiumPageHeader } from "@/components/layout/PremiumPageHeader";
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
        .limit(2000)
    : { data: [] };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pt-6 sm:pt-10">
      <PremiumPageHeader
        eyebrow="Financeiro · OperaRoute"
        title="Pendências"
        subtitle="Débitos e pagamentos em aberto por ponto"
        action={
          <Link
            href="/pendencias/nova"
            className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/10 px-4 py-2.5 text-sm font-medium text-at-link transition hover:bg-[#c4a574]/20"
          >
            <Plus className="h-4 w-4" />
            Nova pendência
          </Link>
        }
      />
      <PendenciasClient pendencias={pendencias ?? []} />
    </div>
  );
}
