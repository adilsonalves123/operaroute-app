import { Suspense } from "react";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { EstoqueClient } from "@/components/estoque/EstoqueClient";
import type { KitNoEstoqueCentral } from "@/components/estoque/EstoqueKitRow";
import type { EstoqueItem } from "@/lib/types/database";
import type { EquipamentoTipo } from "@/lib/equipamentos";

function parseCategoriaInicial(
  raw: string | undefined
): "Pecas" | "Brindes" | "Equipamentos" | null {
  const cat = (raw ?? "").toLowerCase();
  if (cat === "pecas" || cat === "peças") return "Pecas";
  if (cat === "brindes") return "Brindes";
  if (cat === "equipamentos" || cat === "maquinas") return "Equipamentos";
  return null;
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria: categoriaRaw } = await searchParams;
  const categoriaInicial = parseCategoriaInicial(categoriaRaw);

  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const empresaId = profile?.empresa_id;
  const empresa = empresaId ? await getEmpresa(empresaId) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  let items: EstoqueItem[] = [];
  let pontos: { id: string; nome: string }[] = [];
  let kits: KitNoEstoqueCentral[] = [];
  let equipamentosEstoque: {
    id: string;
    nome: string;
    tipo: EquipamentoTipo;
    numero_maquina: string | null;
    numero_serie: string | null;
    status: string;
    foto_url: string | null;
    ponto_id: string | null;
  }[] = [];

  if (empresaId) {
    const [
      { data: itemsData },
      { data: pontosData },
      { data: kitsRaw },
      { data: equipamentosData },
    ] = await Promise.all([
      supabase
        .from("estoque")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome_item"),
      supabase
        .from("pontos")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .order("nome"),
      supabase
        .from("fura_kits")
        .select("id, nome, foto_url, ativo")
        .eq("empresa_id", empresaId)
        .order("ordem")
        .order("nome"),
      supabase
        .from("equipamentos")
        .select(
          "id, nome, tipo, numero_maquina, numero_serie, status, foto_url, ponto_id"
        )
        .eq("empresa_id", empresaId)
        .is("ponto_id", null)
        .order("nome"),
    ]);

    items = (itemsData ?? []) as EstoqueItem[];
    pontos = pontosData ?? [];
    equipamentosEstoque = (equipamentosData ?? []) as typeof equipamentosEstoque;

    const kitIds = (kitsRaw ?? []).map((k) => k.id);
    const estoqueFotos = new Map(items.map((i) => [i.id, i.foto_url ?? null] as const));

    const [{ data: reposicao }, { data: kitsEstoque }] = await Promise.all([
      kitIds.length
        ? supabase.from("fura_kit_reposicao_itens").select("*").in("kit_id", kitIds)
        : Promise.resolve({ data: [] as const }),
      supabase
        .from("fura_kits_estoque")
        .select("kit_id, quantidade")
        .eq("empresa_id", empresaId),
    ]);

    const montadosMap = new Map(
      (kitsEstoque ?? []).map((r) => [r.kit_id, Number(r.quantidade) || 0])
    );

    kits = (kitsRaw ?? []).map((k) => {
      const reposicaoItens = (reposicao ?? [])
        .filter((r) => r.kit_id === k.id)
        .map((r) => ({
          estoque_item_id: r.estoque_item_id,
          nome: r.nome,
          quantidade: Number(r.quantidade) || 0,
          custo_unitario: Number(r.custo_unitario) || 0,
          foto_url: r.estoque_item_id
            ? (estoqueFotos.get(r.estoque_item_id) ?? null)
            : null,
        }));
      const fotoFallback =
        reposicaoItens.find((r) => r.foto_url)?.foto_url ?? null;

      return {
        id: k.id,
        nome: k.nome,
        foto_url: k.foto_url || fotoFallback,
        ativo: Boolean(k.ativo),
        quantidade_montada: montadosMap.get(k.id) ?? 0,
        reposicao_itens: reposicaoItens,
      };
    });
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-at-muted">
          Carregando estoque…
        </div>
      }
    >
      <EstoqueClient
        items={items}
        kits={kits}
        pontos={pontos}
        categoriaInicial={categoriaInicial}
        equipamentosEstoque={equipamentosEstoque}
        nichosAtivos={nichosAtivos}
      />
    </Suspense>
  );
}
