import { createClient, getProfile } from "@/lib/supabase/server";
import { ChamadosClient } from "@/components/chamados/ChamadosClient";
import type { ChamadoComEventos } from "@/lib/chamados/types";
import { isCategoriaPecas } from "@/lib/estoque/categorias";

export default async function ChamadosPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  const empresaId = profile?.empresa_id;

  const [{ data: chamados, error }, { data: estoqueItems }] = empresaId
    ? await Promise.all([
        supabase
          .from("chamados")
          .select(
            "id, empresa_id, ponto_id, equipamento_id, criado_por_id, responsavel_id, titulo, descricao, prioridade, status, observacao_resolucao, iniciado_em, concluido_em, created_at, pontos(nome), equipamentos(nome, tipo, numero_maquina)"
          )
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("estoque")
          .select("id, nome_item, quantidade, custo_unitario, categoria")
          .eq("empresa_id", empresaId)
          .order("nome_item"),
      ])
    : [
        { data: [], error: null },
        { data: [] },
      ];

  const pecasEstoque = (estoqueItems ?? [])
    .filter((i) => isCategoriaPecas(i.categoria))
    .map((i) => ({
      id: i.id,
      nome_item: i.nome_item,
      quantidade: Number(i.quantidade) || 0,
      custo_unitario: Number(i.custo_unitario) || 0,
      categoria: "Pecas",
      isPeca: true,
    }));

  return (
    <ChamadosClient
      chamados={(chamados ?? []) as unknown as ChamadoComEventos[]}
      pecasEstoque={pecasEstoque}
      loadError={error ? true : false}
    />
  );
}
