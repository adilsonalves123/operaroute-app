import type { SupabaseClient } from "@supabase/supabase-js";

export type VisaoValorLinha = {
  ponto_id: string;
  data: string;
  valor_exibido: number;
  publicado_em: string;
  pontos: { nome: string; cidade: string | null } | null;
};

export async function listarValoresVisao(
  supabase: SupabaseClient,
  empresaId: string,
  equipeId: string,
  opts?: { data?: string; limit?: number }
): Promise<VisaoValorLinha[]> {
  let q = supabase
    .from("visao_valores")
    .select("ponto_id, data, valor_exibido, publicado_em, pontos(nome, cidade)")
    .eq("empresa_id", empresaId)
    .eq("equipe_id", equipeId)
    .order("data", { ascending: false })
    .order("publicado_em", { ascending: false });

  if (opts?.data) {
    q = q.eq("data", opts.data);
  }

  const { data } = await q.limit(opts?.limit ?? 80);
  return (data ?? []) as unknown as VisaoValorLinha[];
}

export async function valoresVisaoDoDia(
  supabase: SupabaseClient,
  empresaId: string,
  equipeId: string,
  dataISO: string
): Promise<VisaoValorLinha[]> {
  return listarValoresVisao(supabase, empresaId, equipeId, { data: dataISO, limit: 200 });
}

export async function datasComValoresVisao(
  supabase: SupabaseClient,
  empresaId: string,
  equipeId: string,
  limite = 45
): Promise<string[]> {
  const { data } = await supabase
    .from("visao_valores")
    .select("data")
    .eq("empresa_id", empresaId)
    .eq("equipe_id", equipeId)
    .order("data", { ascending: false })
    .limit(800);

  const visto = new Set<string>();
  const datas: string[] = [];
  for (const row of data ?? []) {
    const d = String(row.data ?? "");
    if (!d || visto.has(d)) continue;
    visto.add(d);
    datas.push(d);
    if (datas.length >= limite) break;
  }
  return datas;
}
