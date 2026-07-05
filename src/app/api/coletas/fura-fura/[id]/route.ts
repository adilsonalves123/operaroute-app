import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import { parseBrindesSalvos } from "@/lib/nichos/fura-fura/reconstruct-coleta";

type EstoqueBrinde = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

function restaurarEstoqueBrindes(
  estoque: EstoqueBrinde[],
  brindes: ReturnType<typeof parseBrindesSalvos>
): EstoqueBrinde[] {
  const next = estoque.map((e) => ({ ...e }));
  for (const b of brindes) {
    const idx = b.item_id
      ? next.findIndex((e) => e.item_id === b.item_id)
      : next.findIndex((e) => e.nome === b.nome);
    if (idx >= 0) {
      next[idx].quantidade = (next[idx].quantidade ?? 0) + b.quantidade;
    } else {
      next.push({
        item_id: b.item_id ?? randomUUID(),
        nome: b.nome,
        quantidade: b.quantidade,
        custo_unitario: b.custo_unitario,
      });
    }
  }
  return next;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: coleta, error: coletaError } = await supabase
    .from("coletas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
    .maybeSingle();

  if (coletaError || !coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, furos_estoque, estoque_brindes")
    .eq("id", coleta.ponto_id)
    .maybeSingle();

  await supabase.from("coleta_pagamentos").delete().eq("coleta_id", id);
  await supabase.from("financeiro").delete().eq("coleta_id", id);
  await supabase
    .from("pendencias")
    .delete()
    .eq("coleta_id", id)
    .eq("empresa_id", profile.empresa_id);

  const { error: deleteError } = await supabase.from("coletas").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (ponto) {
    const pontoUpdates: Record<string, unknown> = {};
    const furos = Number(coleta.quantidade_furos ?? 0);
    if (furos > 0 && ponto.furos_estoque != null) {
      pontoUpdates.furos_estoque = Number(ponto.furos_estoque) + furos;
    }
    const brindes = parseBrindesSalvos(coleta.brindes_entregues);
    if (brindes.length > 0 && Array.isArray(ponto.estoque_brindes)) {
      pontoUpdates.estoque_brindes = restaurarEstoqueBrindes(
        ponto.estoque_brindes as EstoqueBrinde[],
        brindes
      );
    }
    if (Object.keys(pontoUpdates).length > 0) {
      await supabase.from("pontos").update(pontoUpdates).eq("id", ponto.id);
    }
  }

  return NextResponse.json({ success: true });
}
