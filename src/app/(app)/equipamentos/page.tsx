import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { EquipamentosGlobalClient } from "@/components/equipamentos/EquipamentosGlobalClient";
import { fetchChamadosAbertosResumo } from "@/lib/chamados/fetch-resumo";
import type { ChamadoResumoEquipamento } from "@/lib/chamados/types";
import type { Equipamento } from "@/lib/types/database";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { resolverVisaoOperador } from "@/lib/visao/resolver";

export default async function EquipamentosPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const empresaId = profile?.empresa_id;
  const empresa = empresaId ? await getEmpresa(empresaId) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const acessoEq = empresaId
    ? await getAcessoUsuario(supabase, profile!, empresa?.owner_id)
    : null;
  const visaoEq = acessoEq
    ? await resolverVisaoOperador(supabase, acessoEq)
    : { restrita: false, pontoIds: [] as string[], equipeId: null };

  const [{ data: equipamentosRaw, error }, { data: pontosRaw }, chamadosResumo] = empresaId
    ? await Promise.all([
        supabase
          .from("equipamentos")
          .select("*, pontos(id, nome, status)")
          .eq("empresa_id", empresaId)
          .order("nome"),
        supabase
          .from("pontos")
          .select("id, nome")
          .eq("empresa_id", empresaId)
          .eq("status", "ativo")
          .order("nome"),
        fetchChamadosAbertosResumo(empresaId),
      ])
    : [{ data: [], error: null }, { data: [] }, { total: 0, porPonto: new Map(), lista: [] }];

  const pontos = visaoEq.restrita
    ? (pontosRaw ?? []).filter((p) => visaoEq.pontoIds.includes(p.id))
    : pontosRaw ?? [];
  const equipamentos = visaoEq.restrita
    ? ((equipamentosRaw ?? []) as { ponto_id?: string | null }[]).filter(
        (e) => e.ponto_id && visaoEq.pontoIds.includes(e.ponto_id)
      )
    : equipamentosRaw ?? [];

  const chamadosAbertos: ChamadoResumoEquipamento[] = chamadosResumo.lista
    .filter((c) => c.equipamento_id)
    .map((c) => ({
      id: c.id,
      equipamento_id: c.equipamento_id,
      status: c.status,
      titulo: c.titulo,
    }));

  return (
    <div className="w-full">
      {error && (
        <p className="mb-6 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 text-sm text-rose-600 dark:text-rose-300">
          Não foi possível carregar os equipamentos.
        </p>
      )}

      <EquipamentosGlobalClient
        equipamentos={(equipamentos ?? []) as (Equipamento & {
          pontos?: { id: string; nome: string; status?: string } | null;
        })[]}
        pontos={pontos ?? []}
        chamadosAbertos={chamadosAbertos}
        nichosAtivos={nichosAtivos}
      />
    </div>
  );
}
