import { createClient, getProfile } from "@/lib/supabase/server";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import { PremiumPageHeader } from "@/components/layout/PremiumPageHeader";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchComposicaoCaixa } from "@/lib/financeiro/saldo-caixa";

export default async function FinanceiroPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  const empresaId = profile?.empresa_id;
  const visitasCutoff = new Date();
  visitasCutoff.setFullYear(visitasCutoff.getFullYear() - 1);

  const [{ data: lancamentos }, { data: visitas }, composicao] = empresaId
    ? await Promise.all([
        supabase
          .from("financeiro")
          .select(
            "id, empresa_id, tipo, categoria, valor, descricao, forma_pagamento, ponto_id, coleta_id, visita_id, operador_id, data, created_at, visitas(valor_pix, valor_dinheiro, debito_abatido, desconto, desconto_recebimento, created_at)"
          )
          .eq("empresa_id", empresaId)
          .order("data", { ascending: false })
          .limit(300),
        supabase
          .from("visitas")
          .select("id, desconto, desconto_recebimento, created_at")
          .eq("empresa_id", empresaId)
          .gte("created_at", visitasCutoff.toISOString())
          .order("created_at", { ascending: false })
          .limit(400),
        fetchComposicaoCaixa(supabase, empresaId),
      ])
    : [
        { data: [] },
        { data: [] },
        { saldo: 0, pix: 0, dinheiro: 0, naoClassificado: 0 },
      ];

  const visitasById = new Map((visitas ?? []).map((v) => [v.id, v] as const));
  for (const l of lancamentos ?? []) {
    const joined = Array.isArray(l.visitas) ? l.visitas[0] : l.visitas;
    if (!l.visita_id || !joined?.created_at || visitasById.has(l.visita_id)) continue;
    visitasById.set(l.visita_id, {
      id: l.visita_id,
      desconto: joined.desconto ?? null,
      desconto_recebimento: joined.desconto_recebimento ?? null,
      created_at: joined.created_at,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 pt-6 sm:pt-10">
      <PremiumPageHeader
        eyebrow="Caixa · OperaRoute"
        title="Financeiro"
        subtitle="Caixa, descontos e o que moveu na operação"
        action={
          <Link
            href="/financeiro/novo"
            className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/10 px-4 py-2.5 text-sm font-medium text-at-link transition hover:bg-[#c4a574]/20"
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </Link>
        }
      />

      <FinanceiroDashboard
        lancamentos={
          (lancamentos ?? []) as unknown as Parameters<
            typeof FinanceiroDashboard
          >[0]["lancamentos"]
        }
        visitas={[...visitasById.values()]}
        composicao={composicao}
      />
    </div>
  );
}
