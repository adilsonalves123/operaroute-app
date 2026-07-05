import type { SupabaseClient } from "@supabase/supabase-js";
import type { PontoStatus } from "@/lib/types/database";

export type MovimentoPontoTipo = "entrada" | "saida";

function isMissingMovimentosTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("pontos_movimentos") &&
    (m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find"))
  );
}

export async function registrarMovimentoPonto(
  supabase: SupabaseClient,
  params: {
    empresa_id: string;
    ponto_id: string | null;
    ponto_nome: string;
    tipo: MovimentoPontoTipo;
    motivo: string;
  }
): Promise<void> {
  const { error } = await supabase.from("pontos_movimentos").insert({
    empresa_id: params.empresa_id,
    ponto_id: params.ponto_id,
    ponto_nome: params.ponto_nome,
    tipo: params.tipo,
    motivo: params.motivo,
  });

  if (error && !isMissingMovimentosTable(error.message)) {
    console.error("[pontos_movimentos]", error.message);
  }
}

export function motivoSaidaPorStatus(status: PontoStatus): string {
  return status;
}

export function motivoEntradaPorStatus(anterior: PontoStatus): string {
  if (anterior === "ativo") return "cadastro";
  return "reativacao";
}
