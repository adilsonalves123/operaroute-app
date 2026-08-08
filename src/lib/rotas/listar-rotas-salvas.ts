import type { RotaSalva } from "./rotas-salvas";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function listarRotasSalvas(
  supabase: Supabase,
  empresaId: string,
  userId: string,
  podeGerenciar: boolean
): Promise<RotaSalva[]> {
  let query = supabase
    .from("rotas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (!podeGerenciar) {
    query = query.eq("operador_id", userId);
  }

  const { data: rotas } = await query;
  if (!rotas?.length) return [];

  const rotaIds = rotas.map((r) => r.id);

  const operadorIds = [
    ...new Set(rotas.map((r) => r.operador_id).filter(Boolean)),
  ] as string[];

  const nomesOperador = new Map<string, string>();
  const [{ data: paradas }, { data: equipe }] = await Promise.all([
    supabase
      .from("rota_pontos")
      .select("id, rota_id, ponto_id, ordem, status, observacao")
      .in("rota_id", rotaIds)
      .order("ordem"),
    operadorIds.length
      ? supabase
          .from("equipe")
          .select("user_id, nome")
          .eq("empresa_id", empresaId)
          .in("user_id", operadorIds)
      : Promise.resolve({ data: [] }),
  ]);
  for (const m of equipe ?? []) {
    if (m.user_id) nomesOperador.set(m.user_id, m.nome);
  }

  const paradasPorRota = new Map<string, RotaSalva["paradas"]>();
  for (const p of paradas ?? []) {
    const list = paradasPorRota.get(p.rota_id) ?? [];
    list.push({
      id: p.id,
      ponto_id: p.ponto_id,
      ordem: p.ordem,
      status: p.status,
      observacao: p.observacao,
    });
    paradasPorRota.set(p.rota_id, list);
  }

  return rotas.map((r) => {
    const ps = (paradasPorRota.get(r.id) ?? []).sort((a, b) => a.ordem - b.ordem);
    return {
      ...r,
      paradas: ps,
      total_paradas: ps.length,
      operador_nome: r.operador_id ? nomesOperador.get(r.operador_id) ?? null : null,
    };
  });
}
