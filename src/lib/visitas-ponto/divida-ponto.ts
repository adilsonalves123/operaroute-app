import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";

export type PendenciaCobravel = {
  id: string;
  tipo: string;
  titulo: string;
  valor: number;
  coleta_id: string | null;
  visita_id: string | null;
  visita_ponto_id: string | null;
  descricao: string | null;
  created_at: string;
};

export type DividaPontoOpts = {
  /** Não incluir a própria pendência consolidada desta visita (se já existir). */
  excluirVisitaPontoId?: string;
  /**
   * Visitas cassino já registradas nesta visita ao ponto.
   * Pendências geradas por elas (ex.: negativo) NÃO são dívida anterior —
   * ficam na própria pendência e não devem virar visita_consolidada de novo.
   */
  excluirVisitaIds?: string[];
};

function valorCobravelPendencia(p: PendenciaCobravel): number {
  if (p.tipo === "haver") return 0;
  if (p.tipo === "negativo") {
    return saldoPendenciaReais({
      id: p.id,
      valor: p.valor,
      observacao: p.descricao,
    });
  }
  return Math.max(0, Number(p.valor ?? 0));
}

/** IDs de visitas cassino vinculadas a uma visita ao ponto. */
export async function fetchCassinoVisitaIdsVisitaPonto(
  supabase: SupabaseClient,
  visitaPontoId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("visita_ponto_itens")
    .select("cassino_visita_id")
    .eq("visita_ponto_id", visitaPontoId)
    .not("cassino_visita_id", "is", null);

  return [
    ...new Set(
      (data ?? [])
        .map((r) => r.cassino_visita_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

export async function listarPendenciasCobraveisPonto(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string,
  opts?: DividaPontoOpts
): Promise<PendenciaCobravel[]> {
  const excluirVisitaIds = new Set(opts?.excluirVisitaIds ?? []);

  const { data } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, coleta_id, visita_id, visita_ponto_id, descricao, created_at")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId)
    .eq("status", "aberta")
    .order("created_at", { ascending: true });

  return (data ?? []).filter((p) => {
    if (p.tipo === "haver") return false;
    if (opts?.excluirVisitaPontoId && p.visita_ponto_id === opts.excluirVisitaPontoId) {
      return false;
    }
    if (p.visita_id && excluirVisitaIds.has(p.visita_id)) return false;
    return valorCobravelPendencia(p as PendenciaCobravel) > 0.009;
  }) as PendenciaCobravel[];
}

export async function totalDividaAnteriorPonto(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string,
  opts?: string | DividaPontoOpts
): Promise<number> {
  const normalized: DividaPontoOpts =
    typeof opts === "string" ? { excluirVisitaPontoId: opts } : opts ?? {};

  const lista = await listarPendenciasCobraveisPonto(supabase, empresaId, pontoId, normalized);
  return Math.round(lista.reduce((s, p) => s + valorCobravelPendencia(p), 0) * 100) / 100;
}
