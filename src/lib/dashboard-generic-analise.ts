import type { SupabaseClient } from "@supabase/supabase-js";
import { computePulsoOperacao, type PulsoOperacao } from "@/lib/dashboard-pulso";
import { fetchCartelaPontos, type CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import type { Ponto } from "@/lib/types/database";
import type { PulsoEvento } from "@/lib/dashboard-pulso";

function coletasToPulsoEventos(
  coletas: {
    id: string;
    ponto_id: string;
    visita_id: string | null;
    created_at: string;
    lucro_centavos: number | null;
    valor_liquido: number | null;
    valor_bruto: number | null;
    entrada: number | null;
  }[]
): PulsoEvento[] {
  const grupos = new Map<
    string,
    { lucroReais: number; negativa: boolean; created_at: string }
  >();

  for (const c of coletas) {
    const key = c.visita_id ?? `${c.ponto_id}:${c.created_at.slice(0, 10)}`;
    const lucro =
      c.lucro_centavos != null
        ? centesimosToReais(Number(c.lucro_centavos))
        : Number(c.valor_liquido ?? c.valor_bruto ?? c.entrada ?? 0);
    const prev = grupos.get(key);
    if (prev) {
      prev.lucroReais += lucro;
      prev.negativa = prev.negativa || lucro < -0.009;
    } else {
      grupos.set(key, {
        lucroReais: lucro,
        negativa: lucro < -0.009,
        created_at: c.created_at,
      });
    }
  }

  return [...grupos.values()].map((g) => ({
    created_at: g.created_at,
    lucroReais: g.lucroReais,
    negativa: g.negativa || g.lucroReais < -0.009,
  }));
}

export async function getGenericAnaliseData(
  supabase: SupabaseClient,
  empresaId: string
): Promise<{
  ranking: { ponto: Ponto; valor: number }[];
  pulso: PulsoOperacao;
  cartela: CartelaPontos;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: coletas }, { data: coletasPulso }, { data: pontos }, cartela] = await Promise.all([
    supabase
      .from("coletas")
      .select("valor_bruto, entrada, ponto_id, created_at")
      .eq("empresa_id", empresaId)
      .gte("created_at", startOfMonth),
    supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_centavos, valor_liquido, valor_bruto, entrada"
      )
      .eq("empresa_id", empresaId)
      .gte("created_at", thirtyFiveDaysAgo),
    supabase.from("pontos").select("*").eq("empresa_id", empresaId),
    fetchCartelaPontos(supabase, empresaId),
  ]);

  const rankingMap = new Map<string, number>();
  coletas?.forEach((c) => {
    if (c.ponto_id) {
      rankingMap.set(
        c.ponto_id,
        (rankingMap.get(c.ponto_id) ?? 0) + Number(c.valor_bruto ?? c.entrada ?? 0)
      );
    }
  });

  const ranking = [...rankingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pontoId, valor]) => ({
      ponto: pontos?.find((p) => p.id === pontoId),
      valor,
    }))
    .filter((r): r is { ponto: Ponto; valor: number } => Boolean(r.ponto));

  const pulso = computePulsoOperacao(coletasToPulsoEventos(coletasPulso ?? []));

  return { ranking, pulso, cartela };
}
