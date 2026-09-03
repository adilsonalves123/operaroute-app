import { Boxes } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  EstoqueAlocadosClient,
  type MaquinaAlocada,
  type PontoFuraAlocado,
} from "@/components/estoque/EstoqueAlocadosClient";
import { EstoqueNavTabs } from "@/components/estoque/EstoqueNavTabs";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";

function temBrindes(estoque: unknown): boolean {
  return normalizarEstoqueBrindesPonto(estoque).some((b) => Number(b.quantidade) > 0);
}

export default async function EstoqueAlocadosPage() {
  const profile = await getProfile();
  const empresaId = profile?.empresa_id;

  if (!empresaId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-at-primary">Estoque nos clientes</h1>
        <p className="text-at-muted">Empresa não encontrada.</p>
      </div>
    );
  }

  const supabase = await createClient();

  const [pontosRes, kitsRes, equipamentosRes] = await Promise.all([
    supabase
      .from("pontos")
      .select(
        "id, nome, cidade, bairro, kit_ativo_id, kit_instalado_em, furos_estoque, furos_minimo, estoque_brindes"
      )
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .order("nome"),
    supabase.from("fura_kits").select("id, nome").eq("empresa_id", empresaId),
    supabase
      .from("equipamentos")
      .select("id, nome, tipo, ponto_id, numero_maquina, estoque_brindes")
      .eq("empresa_id", empresaId)
      .not("ponto_id", "is", null)
      .in("tipo", ["ursinho", "vending_ursinho", "bolinha", "consignado"]),
  ]);

  const kits = kitsRes.data ?? [];
  const kitIds = kits.map((k) => k.id);

  const reposicaoRes =
    kitIds.length > 0
      ? await supabase
          .from("fura_kit_reposicao_itens")
          .select("kit_id, nome, quantidade, estoque_item_id")
          .in("kit_id", kitIds)
      : { data: [] as { kit_id: string; nome: string; quantidade: number; estoque_item_id: string | null }[], error: null };

  const erros = [
    pontosRes.error?.message,
    kitsRes.error?.message,
    reposicaoRes.error?.message,
    equipamentosRes.error?.message,
  ].filter(Boolean);

  const pontos = pontosRes.data ?? [];
  const reposicao = reposicaoRes.data ?? [];
  const equipamentos = equipamentosRes.data ?? [];

  const kitsMap = new Map(kits.map((k) => [k.id, k.nome as string]));

  const reposicaoByKit = new Map<
    string,
    { nome: string; quantidade: number; estoque_item_id?: string | null }[]
  >();
  for (const r of reposicao) {
    const list = reposicaoByKit.get(r.kit_id) ?? [];
    list.push({
      nome: r.nome,
      quantidade: Number(r.quantidade) || 0,
      estoque_item_id: r.estoque_item_id,
    });
    reposicaoByKit.set(r.kit_id, list);
  }

  const pontosMap = new Map(pontos.map((p) => [p.id, p]));

  // Só pontos com kit ou brindes — evita lista enorme vazia.
  const furaPontos: PontoFuraAlocado[] = pontos
    .filter((p) => Boolean(p.kit_ativo_id) || temBrindes(p.estoque_brindes))
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      cidade: p.cidade ?? null,
      bairro: p.bairro ?? null,
      kit_ativo_id: p.kit_ativo_id ?? null,
      kit_nome: p.kit_ativo_id ? (kitsMap.get(p.kit_ativo_id) ?? null) : null,
      kit_instalado_em: p.kit_instalado_em ?? null,
      furos_estoque: p.furos_estoque ?? null,
      furos_minimo: p.furos_minimo ?? null,
      estoque_brindes: p.estoque_brindes,
      reposicao: p.kit_ativo_id ? (reposicaoByKit.get(p.kit_ativo_id) ?? []) : [],
    }));

  function mapMaquinas(tipos: string[]): MaquinaAlocada[] {
    return equipamentos
      .filter((e) => tipos.includes(e.tipo) && e.ponto_id && pontosMap.has(e.ponto_id))
      .map((e) => {
        const ponto = pontosMap.get(e.ponto_id as string)!;
        return {
          id: e.id,
          nome: e.nome,
          tipo: e.tipo,
          ponto_id: e.ponto_id as string,
          ponto_nome: ponto.nome,
          numero_maquina: e.numero_maquina ?? null,
          estoque_brindes: e.estoque_brindes,
        };
      });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <EstoqueNavTabs active="alocados" />

      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-at bg-at-card-soft p-2">
          <Boxes className="h-5 w-5 text-at-link" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-at-primary">Estoque nos clientes</h1>
          <p className="mt-1 text-sm text-at-muted">
            O que ainda está alocado em cada ponto — por nicho. No Fura Fura, veja o % do kit
            restante e quem tem potencial de troca.
          </p>
        </div>
      </div>

      {erros.length > 0 && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Erro ao carregar: {erros.join(" · ")}
        </div>
      )}

      <EstoqueAlocadosClient
        furaPontos={furaPontos}
        ursinho={mapMaquinas(["ursinho", "vending_ursinho"])}
        bolinha={mapMaquinas(["bolinha"])}
        consignado={mapMaquinas(["consignado"])}
      />
    </div>
  );
}
