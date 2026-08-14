import type { SupabaseClient } from "@supabase/supabase-js";
import { calcComissaoStaff, clampComissaoPercentual } from "@/lib/equipe/comissao-staff";
import { userIdDoVale } from "@/lib/equipe/vale-staff";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ComissaoStaffPeriodoLinha = {
  userId: string;
  nome: string;
  percentual: number;
  /** Lucro livre da coleta (já descontou comissão do ponto e brinde). */
  baseLivre: number;
  valor: number;
  /** Saídas de vale/pagamento já dadas no período. */
  vales: number;
  /** Comissão − vales (não fica negativo). */
  aPagar: number;
};

export type ComissaoStaffPeriodo = {
  linhas: ComissaoStaffPeriodoLinha[];
  total: number;
  totalVales: number;
  totalAPagar: number;
};

/**
 * Comissão do ajudante no período: % da Equipe sobre o que sobrou livre
 * (coleta − comissão do ponto − brinde). Não altera lançamento nem caixa.
 */
export async function fetchComissaoStaffPeriodo(
  supabase: SupabaseClient,
  empresaId: string,
  inicioISO: string,
  fimISO: string,
  opts?: { somenteUserId?: string | null }
): Promise<ComissaoStaffPeriodo> {
  const vazio: ComissaoStaffPeriodo = { linhas: [], total: 0, totalVales: 0, totalAPagar: 0 };

  const { data: equipe } = await supabase
    .from("equipe")
    .select("user_id, nome, comissao_percentual, status")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  const membros = (equipe ?? [])
    .map((m) => ({
      userId: String(m.user_id ?? "").toLowerCase(),
      nome: String(m.nome ?? "Ajudante"),
      percentual: clampComissaoPercentual(m.comissao_percentual),
    }))
    .filter((m) => m.userId && m.percentual > 0);

  const filtrados = opts?.somenteUserId
    ? membros.filter((m) => m.userId === String(opts.somenteUserId).toLowerCase())
    : membros;

  if (filtrados.length === 0) return vazio;

  const ids = new Set(filtrados.map((m) => m.userId));
  const pctPorUser = new Map(filtrados.map((m) => [m.userId, m.percentual]));

  const inicioData = inicioISO.slice(0, 10);
  const fimData = fimISO.slice(0, 10);

  const [{ data: coletas }, { data: visitas }, { data: lancamentos }] = await Promise.all([
    supabase
      .from("coletas")
      .select("operador_id, lucro_real")
      .eq("empresa_id", empresaId)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO),
    supabase
      .from("visitas")
      .select("operador_id, valor_operacao, saldo_negativo")
      .eq("empresa_id", empresaId)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO),
    supabase
      .from("financeiro")
      .select("valor, descricao, tipo, data")
      .eq("empresa_id", empresaId)
      .eq("tipo", "saida")
      .gte("data", inicioData)
      .lte("data", fimData),
  ]);

  const basePorUser = new Map<string, number>();
  const valorPorUser = new Map<string, number>();
  for (const id of ids) {
    basePorUser.set(id, 0);
    valorPorUser.set(id, 0);
  }

  function somarLivre(userId: string, livre: number) {
    const pct = pctPorUser.get(userId);
    if (pct == null) return;
    if (!Number.isFinite(livre)) return;
    basePorUser.set(userId, (basePorUser.get(userId) ?? 0) + livre);
    valorPorUser.set(
      userId,
      (valorPorUser.get(userId) ?? 0) + calcComissaoStaff(livre, pct)
    );
  }

  for (const c of coletas ?? []) {
    somarLivre(String(c.operador_id ?? "").toLowerCase(), Number(c.lucro_real ?? 0));
  }

  for (const v of visitas ?? []) {
    if (v.saldo_negativo) continue;
    somarLivre(String(v.operador_id ?? "").toLowerCase(), Number(v.valor_operacao ?? 0));
  }

  const valesPorUser = new Map<string, number>();
  for (const id of ids) valesPorUser.set(id, 0);

  for (const l of lancamentos ?? []) {
    const uid = userIdDoVale(l.descricao);
    if (!uid || !ids.has(uid)) continue;
    const v = Number(l.valor ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    valesPorUser.set(uid, (valesPorUser.get(uid) ?? 0) + v);
  }

  const linhas = filtrados.map((m) => {
    const baseLivre = round2(basePorUser.get(m.userId) ?? 0);
    const valor = round2(valorPorUser.get(m.userId) ?? 0);
    const vales = round2(valesPorUser.get(m.userId) ?? 0);
    return {
      ...m,
      baseLivre,
      valor,
      vales,
      aPagar: round2(Math.max(0, valor - vales)),
    };
  });

  const total = round2(linhas.reduce((s, l) => s + l.valor, 0));
  const totalVales = round2(linhas.reduce((s, l) => s + l.vales, 0));
  const totalAPagar = round2(linhas.reduce((s, l) => s + l.aPagar, 0));
  return { linhas, total, totalVales, totalAPagar };
}

/** Esconde comissão de outros membros quando quem vê não é dono/admin/gerente. */
export function filtrarComissaoStaffParaViewer(
  data: ComissaoStaffPeriodo,
  viewer: { userId?: string | null; isOwner: boolean; role: string }
): ComissaoStaffPeriodo {
  if (viewer.isOwner || viewer.role === "admin" || viewer.role === "gerente") {
    return data;
  }
  const linhas = data.linhas.filter(
    (l) => l.userId === String(viewer.userId ?? "").toLowerCase()
  );
  const total = round2(linhas.reduce((s, l) => s + l.valor, 0));
  const totalVales = round2(linhas.reduce((s, l) => s + l.vales, 0));
  const totalAPagar = round2(linhas.reduce((s, l) => s + l.aPagar, 0));
  return { linhas, total, totalVales, totalAPagar };
}
