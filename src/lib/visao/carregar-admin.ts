import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";

export async function carregarDadosPainelRestrito() {
  const profile = await getProfile();
  const supabase = await createClient();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const acesso = profile?.empresa_id
    ? await getAcessoUsuario(supabase, profile, empresa?.owner_id)
    : null;

  if (!profile?.empresa_id) {
    return {
      profile,
      empresa,
      acesso,
      membros: [] as { id: string; nome: string; role: string; status: string; visao_restrita?: boolean }[],
      pontos: [] as { id: string; nome: string }[],
      visaoPontosPorEquipe: {} as Record<string, string[]>,
    };
  }

  const [membrosRes, pontosRes, visaoRes] = await Promise.all([
    supabase
      .from("equipe")
      .select("*")
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
    supabase
      .from("pontos")
      .select("id, nome")
      .eq("empresa_id", profile.empresa_id)
      .order("nome"),
    supabase
      .from("visao_pontos")
      .select("equipe_id, ponto_id")
      .eq("empresa_id", profile.empresa_id),
  ]);

  const visaoPontosPorEquipe: Record<string, string[]> = {};
  if (!visaoRes.error) {
    for (const row of visaoRes.data ?? []) {
      const list = visaoPontosPorEquipe[row.equipe_id] ?? [];
      list.push(row.ponto_id);
      visaoPontosPorEquipe[row.equipe_id] = list;
    }
  }

  return {
    profile,
    empresa,
    acesso,
    membros: membrosRes.data ?? [],
    pontos: pontosRes.data ?? [],
    visaoPontosPorEquipe,
  };
}
