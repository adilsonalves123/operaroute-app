import { createClient, getProfile } from "@/lib/supabase/server";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import Link from "next/link";
import { Plus } from "lucide-react";
import { totalDividasAbatidas } from "@/lib/financeiro/breakdown";

export default async function FinanceiroPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const empresaId = profile?.empresa_id;

  const [{ data: lancamentos }, { data: pendenciasNegativas }, { data: visitas }] = empresaId
    ? await Promise.all([
        supabase
          .from("financeiro")
          .select(
            "*, visitas(valor_pix, valor_dinheiro, debito_abatido, desconto, desconto_recebimento)"
          )
          .eq("empresa_id", empresaId)
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("pendencias")
          .select("descricao")
          .eq("empresa_id", empresaId)
          .eq("tipo", "negativo"),
        supabase
          .from("visitas")
          .select("id, desconto, desconto_recebimento, created_at")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .limit(200),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const dividasAbatidasHistorico = totalDividasAbatidas(pendenciasNegativas);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="text-slate-400 mt-1">Caixa real e raio-x da operação cassino</p>
        </div>
        <Link
          href="/financeiro/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          Novo lançamento
        </Link>
      </div>

      <FinanceiroDashboard
        lancamentos={lancamentos ?? []}
        visitas={visitas ?? []}
        dividasAbatidasHistorico={dividasAbatidasHistorico}
      />
    </div>
  );
}
