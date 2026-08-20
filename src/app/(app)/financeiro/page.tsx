import { createClient, getProfile } from "@/lib/supabase/server";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchComposicaoCaixa } from "@/lib/financeiro/saldo-caixa";

export default async function FinanceiroPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  const empresaId = profile?.empresa_id;

  const [{ data: lancamentos }, composicao] = empresaId
    ? await Promise.all([
        supabase
          .from("financeiro")
          .select(
            "id, empresa_id, tipo, categoria, valor, descricao, forma_pagamento, ponto_id, coleta_id, visita_id, operador_id, data, created_at, visitas(valor_pix, valor_dinheiro, debito_abatido, desconto, desconto_recebimento, created_at)"
          )
          .eq("empresa_id", empresaId)
          .order("data", { ascending: false })
          .limit(300),
        fetchComposicaoCaixa(supabase, empresaId),
      ])
    : [
        { data: [] },
        { saldo: 0, pix: 0, dinheiro: 0, naoClassificado: 0 },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="mt-1 text-slate-400">
            Quanto tem no caixa agora — e o que moveu hoje
          </p>
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
        composicao={composicao}
      />
    </div>
  );
}
