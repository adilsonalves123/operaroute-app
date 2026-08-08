import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Saldo real do caixa da empresa: entradas − saídas (todo o histórico).
 * Usado para não deixar o caixa ir abaixo de zero em saídas.
 */
export async function fetchSaldoCaixa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("financeiro")
    .select("tipo, valor")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("[saldo-caixa]", error.message);
    return 0;
  }

  let saldo = 0;
  for (const row of data ?? []) {
    const v = Number(row.valor ?? 0);
    if (!Number.isFinite(v)) continue;
    if (row.tipo === "entrada") saldo += v;
    else if (row.tipo === "saida") saldo -= v;
  }
  return saldo;
}

/** Quanto pode sair do caixa sem deixar saldo negativo (já negativo conta como 0 disponível). */
export function valorSaidaPermitidaNoCaixa(
  saldoAtual: number,
  saidaDesejada: number
): number {
  const disponivel = Math.max(0, saldoAtual);
  const desejada = Math.max(0, saidaDesejada);
  return Math.min(desejada, disponivel);
}
