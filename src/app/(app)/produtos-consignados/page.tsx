import { createClient, getProfile } from "@/lib/supabase/server";
import { ProdutosConsignadosClient } from "@/components/consignado/ProdutosConsignadosClient";
import {
  ExpositoresConsignadoManager,
  type ExpositorItem,
} from "@/components/consignado/ExpositoresConsignadoManager";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import type { ProdutoConsignado } from "@/lib/types/database";

export default async function ProdutosConsignadosPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const empresaId = profile?.empresa_id;

  const [{ data: items }, { data: expositoresRaw }] = empresaId
    ? await Promise.all([
        supabase
          .from("produtos_consignados")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("nome"),
        supabase
          .from("equipamentos")
          .select("id, nome, estoque_brindes, pontos(nome)")
          .eq("empresa_id", empresaId)
          .eq("tipo", "consignado")
          .eq("status", "ativo")
          .order("nome"),
      ])
    : [{ data: [] }, { data: [] }];

  const produtos = (items ?? []) as ProdutoConsignado[];
  const expositores: ExpositorItem[] = (expositoresRaw ?? []).map((e) => {
    const ponto = e.pontos as { nome?: string } | { nome?: string }[] | null;
    const pontoNome = Array.isArray(ponto) ? ponto[0]?.nome : ponto?.nome;
    return {
      id: e.id,
      nome: e.nome,
      pontoNome: pontoNome ?? "Ponto",
      estoque: normalizarEstoqueBrindesPonto(e.estoque_brindes),
    };
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Produtos consignados</h1>
        <p className="text-at-muted mt-1">
          Catálogo dos produtos deixados nos comércios: código, custo, preço de venda e comissão.
        </p>
      </div>
      <ProdutosConsignadosClient items={produtos} />

      <div>
        <h2 className="text-lg font-semibold text-white">Abastecer expositores</h2>
        <p className="text-at-muted mt-1 text-sm">
          Defina quantas unidades de cada produto ficam em cada expositor. No recolhe você conta o
          que sobrou e o sistema calcula o vendido.
        </p>
      </div>
      <ExpositoresConsignadoManager expositores={expositores} produtos={produtos} />
    </div>
  );
}
