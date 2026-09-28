import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  getLimiteEquipamentos,
  limiteEhIlimitado,
  mensagemLimiteEquipamentos,
  podeAdicionarEquipamentos,
} from "@/lib/billing/limite-equipamentos-regras";

export async function contarEquipamentosAtivos(
  supabase: SupabaseClient,
  empresaId: string
): Promise<number> {
  const { count } = await supabase
    .from("equipamentos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");
  return count ?? 0;
}

/**
 * Resposta 403 pronta quando `adicionar` equipamentos passariam do plano;
 * null quando pode seguir.
 */
export async function bloqueioLimiteEquipamentos(
  supabase: SupabaseClient,
  empresa: {
    id: string;
    quantidade_pontos?: string | null;
    limite_pontos?: number | null;
  } | null,
  adicionar: number
): Promise<NextResponse | null> {
  if (!empresa || adicionar <= 0) return null;
  const limite = getLimiteEquipamentos(empresa.quantidade_pontos, empresa.limite_pontos);
  if (limiteEhIlimitado(limite)) return null;
  // Visão restrita do funcionário (RLS) esconderia equipamentos de outros pontos.
  const cliente = isAdminConfigured() ? createAdminClient() : supabase;
  const ativos = await contarEquipamentosAtivos(cliente, empresa.id);
  if (podeAdicionarEquipamentos(ativos, adicionar, limite)) return null;
  return NextResponse.json(
    {
      error: mensagemLimiteEquipamentos(ativos, adicionar, limite),
      limite_atingido: true,
      limite_equipamentos: limite,
      equipamentos_ativos: ativos,
      upgrade_url: "/planos",
    },
    { status: 403 }
  );
}
