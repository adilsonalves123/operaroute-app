import { Suspense } from "react";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { FuraKitsClient } from "@/components/kits/FuraKitsClient";

export default async function KitsEstoquePage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  if (!profile?.empresa_id) {
    return <p className="text-slate-400">Empresa não encontrada.</p>;
  }

  const { data: kits } = await supabase
    .from("fura_kits")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("ordem")
    .order("nome");

  const kitIds = (kits ?? []).map((k) => k.id);

  const [{ data: estoque }, { data: reposicao }, { data: premios }, { data: kitsEstoque }] =
    await Promise.all([
      supabase
        .from("estoque")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("nome_item"),
      kitIds.length
        ? supabase.from("fura_kit_reposicao_itens").select("*").in("kit_id", kitIds)
        : Promise.resolve({ data: [] }),
      kitIds.length
        ? supabase.from("fura_kit_premios").select("*").in("kit_id", kitIds).order("ordem")
        : Promise.resolve({ data: [] }),
      supabase
        .from("fura_kits_estoque")
        .select("kit_id, quantidade")
        .eq("empresa_id", profile.empresa_id),
    ]);

  const montadosMap = new Map(
    (kitsEstoque ?? []).map((r) => [r.kit_id, Number(r.quantidade) || 0])
  );

  const enriched = (kits ?? []).map((k) => ({
    ...k,
    reposicao_itens: (reposicao ?? []).filter((r) => r.kit_id === k.id),
    premios: (premios ?? []).filter((p) => p.kit_id === k.id),
    quantidade_montada: montadosMap.get(k.id) ?? 0,
  }));

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/estoque"
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Estoque central
        </Link>
        <Link
          href="/estoque/alocados"
          className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10"
        >
          Nos clientes
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Carregando kits...</p>}>
        <FuraKitsClient kits={enriched} estoque={estoque ?? []} />
      </Suspense>
    </div>
  );
}
