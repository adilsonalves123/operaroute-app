import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MANUTENCAO_RECENTE_DIAS,
  type ManutencaoRecenteResumo,
} from "@/lib/nichos/cassino/excecoes-contador";

export async function buscarManutencaoRecente(
  supabase: SupabaseClient,
  args: { empresaId: string; equipamentoId: string | null }
): Promise<ManutencaoRecenteResumo> {
  const vazio: ManutencaoRecenteResumo = {
    detectada: false,
    chamadoId: null,
    status: null,
    titulo: null,
    diasDesdeAbertura: null,
  };

  if (!args.equipamentoId) return vazio;

  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - MANUTENCAO_RECENTE_DIAS);

  const { data } = await supabase
    .from("chamados")
    .select("id, status, titulo, created_at, concluido_em")
    .eq("empresa_id", args.empresaId)
    .eq("equipamento_id", args.equipamentoId)
    .gte("created_at", desde.toISOString())
    .in("status", ["aberta", "em_andamento", "concluida"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return vazio;

  const criado = new Date(data.created_at);
  const dias = Math.max(
    0,
    Math.floor((Date.now() - criado.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    detectada: true,
    chamadoId: data.id,
    status: data.status,
    titulo: data.titulo,
    diasDesdeAbertura: dias,
  };
}
