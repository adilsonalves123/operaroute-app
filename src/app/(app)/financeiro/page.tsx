import { createClient, getProfile } from "@/lib/supabase/server";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import Link from "next/link";
import { Plus } from "lucide-react";
import { totalDividasAbatidas } from "@/lib/financeiro/breakdown";
import { fetchSaldoCaixa } from "@/lib/financeiro/saldo-caixa";

export default async function FinanceiroPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  const empresaId = profile?.empresa_id;
  const visitasCutoff = new Date();
  visitasCutoff.setFullYear(visitasCutoff.getFullYear() - 1);

  const [{ data: lancamentos }, { data: pendenciasNegativas }, { data: visitas }, saldoCaixa] =
    empresaId
      ? await Promise.all([
          supabase
            .from("financeiro")
            .select(
              "id, empresa_id, tipo, categoria, valor, descricao, forma_pagamento, ponto_id, coleta_id, visita_id, operador_id, data, created_at, visitas(valor_pix, valor_dinheiro, debito_abatido, desconto, desconto_recebimento, created_at)"
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
            .select("id, desconto, desconto_recebimento, debito_abatido, created_at")
            .eq("empresa_id", empresaId)
            .gte("created_at", visitasCutoff.toISOString())
            .order("created_at", { ascending: false })
            .limit(300),
          fetchSaldoCaixa(supabase, empresaId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, 0];

  const visitasById = new Map((visitas ?? []).map((v) => [v.id, v] as const));
  for (const l of lancamentos ?? []) {
    const joined = Array.isArray(l.visitas) ? l.visitas[0] : l.visitas;
    if (!l.visita_id || !joined?.created_at || visitasById.has(l.visita_id)) continue;
    visitasById.set(l.visita_id, {
      id: l.visita_id,
      desconto: joined.desconto,
      desconto_recebimento: joined.desconto_recebimento,
      debito_abatido: joined.debito_abatido,
      created_at: joined.created_at,
    });
  }
  const visitasMescladas = [...visitasById.values()];

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
        lancamentos={
          (lancamentos ?? []) as unknown as Parameters<
            typeof FinanceiroDashboard
          >[0]["lancamentos"]
        }
        visitas={visitasMescladas}
        dividasAbatidasHistorico={dividasAbatidasHistorico}
        saldoCaixa={saldoCaixa}
      />
    </div>
  );
}
