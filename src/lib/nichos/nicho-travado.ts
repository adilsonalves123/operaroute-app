import { NICHOS_PAGOS } from "@/lib/pricing";
import { getNichoConfig } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Nichos pagos já ativos na operação (travados para o cliente). */
export async function loadNichosPagosAtivos(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Nicho[]> {
  const { data, error } = await supabase
    .from("empresa_nichos")
    .select("nicho")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error || !data?.length) return [];
  return data
    .map((row) => row.nicho as Nicho)
    .filter((n) => NICHOS_PAGOS.includes(n));
}

export function nichosRemovidosIndevidamente(
  atuaisTravados: Nicho[],
  selecionados: Nicho[]
): Nicho[] {
  const set = new Set(selecionados);
  return atuaisTravados.filter((n) => !set.has(n));
}

export function mensagemNichosTravados(removidos: Nicho[]): string {
  const labels = removidos.map((n) => getNichoConfig(n).label).join(", ");
  return (
    `Nicho(s) já confirmado(s) não podem ser trocados: ${labels}. ` +
    "Para alterar, fale com o suporte OperaRoute."
  );
}

export function mensagemConfirmarNicho(nicho: Nicho): string {
  const label = getNichoConfig(nicho).label;
  return (
    `Você está escolhendo o nicho "${label}".\n\n` +
    "Tem certeza? Depois de confirmar, não poderá trocar este nicho sozinho — " +
    "somente o suporte OperaRoute pode alterar."
  );
}
