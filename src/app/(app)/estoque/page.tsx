import { createClient, getProfile } from "@/lib/supabase/server";
import { EstoqueClient } from "@/components/estoque/EstoqueClient";

export default async function EstoquePage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ data: items }, { data: pontos }] = profile?.empresa_id
    ? await Promise.all([
        supabase
          .from("estoque")
          .select("*")
          .eq("empresa_id", profile.empresa_id)
          .order("nome_item"),
        supabase
          .from("pontos")
          .select("id, nome")
          .eq("empresa_id", profile.empresa_id)
          .eq("status", "ativo")
          .order("nome"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Estoque central</h1>
        <p className="text-slate-400 mt-1">
          Brindes e materiais da operação. Alocar para os pontos fura-fura quando necessário.
        </p>
      </div>
      <EstoqueClient items={items ?? []} pontos={pontos ?? []} />
    </div>
  );
}
