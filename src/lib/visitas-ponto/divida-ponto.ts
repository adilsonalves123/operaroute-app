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
  if (p.tipo === "negativo" && !p.visita_id) {
    return Math.max(0, Number(p.valor ?? 0));
  }
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

/**
 * Mapa ponto_id → total cobrável aberto (pendência universal do ponto).
 * Usar nas UIs de coleta de qualquer nicho — mesmo total em fura, cassino, etc.
 */
export function agregarDividaCobravelPorPonto(
  rows: Array<{
    ponto_id?: string | null;
    tipo?: string | null;
    valor?: number | null;
    descricao?: string | null;
    titulo?: string | null;
  }>
): Map<string, { totalPendente: number; coletasAbertas: number }> {
  const map = new Map<string, { totalPendente: number; coletasAbertas: number }>();

  for (const p of rows) {
    const pontoId = p.ponto_id;
    if (!pontoId) continue;
    if ((p.tipo ?? "").toLowerCase() === "haver") continue;

    const cobravel: PendenciaCobravel = {
      id: "",
      tipo: p.tipo ?? "",
      titulo: p.titulo ?? "",
      valor: Number(p.valor ?? 0),
      coleta_id: null,
      visita_id: (p as { visita_id?: string | null }).visita_id ?? null,
      visita_ponto_id: null,
      descricao: p.descricao ?? null,
      created_at: "",
    };
    const v = valorCobravelPendencia(cobravel);
    if (v <= 0.009) continue;

    const prev = map.get(pontoId) ?? { totalPendente: 0, coletasAbertas: 0 };
    map.set(pontoId, {
      totalPendente: Math.round((prev.totalPendente + v) * 100) / 100,
      coletasAbertas: prev.coletasAbertas + 1,
    });
  }

  return map;
}

/** Mapa atualizado de dívida cobrável por ponto (telas de coleta). */
export async function fetchAgregadoDividaCobravelEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Map<string, { totalPendente: number; coletasAbertas: number }>> {
  const { data } = await supabase
    .from("pendencias")
    .select("ponto_id, tipo, titulo, valor, descricao, visita_id")
    .eq("empresa_id", empresaId)
    .eq("status", "aberta");

  return agregarDividaCobravelPorPonto(data ?? []);
}
