import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  calcularColetaFuraFura,
  NICHO_MODULO_FURA_FURA,
  type BrindeEntregue,
} from "@/lib/nichos/fura-fura";

type EstoqueBrindePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

function parseBrindes(raw: unknown): BrindeEntregue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => ({
      item_id: typeof b.item_id === "string" ? b.item_id : undefined,
      nome: String(b.nome ?? "Brinde"),
      quantidade: Math.max(0, Math.floor(Number(b.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(b.custo_unitario) || 0),
    }))
    .filter((b) => b.quantidade > 0);
}

function deduzirEstoquePonto(
  estoque: EstoqueBrindePonto[],
  brindes: BrindeEntregue[]
): EstoqueBrindePonto[] {
  const next = estoque.map((e) => ({ ...e }));
  for (const b of brindes) {
    const idx = b.item_id
      ? next.findIndex((e) => e.item_id === b.item_id)
      : next.findIndex((e) => e.nome === b.nome);
    if (idx >= 0) {
      next[idx].quantidade = Math.max(0, (next[idx].quantidade ?? 0) - b.quantidade);
    }
  }
  return next;
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  const pontoId = String(body.ponto_id ?? "").trim();
  if (!pontoId) {
    return NextResponse.json({ error: "Selecione um ponto." }, { status: 400 });
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .select(
      "id, nome, comissao_percentual, preco_furo, furos_estoque, estoque_brindes, whatsapp"
    )
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (pontoError || !ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  const brindes = parseBrindes(body.brindes);
  const precoFuro =
    body.preco_furo != null && body.preco_furo !== ""
      ? Number(body.preco_furo)
      : Number(ponto.preco_furo ?? 1);

  const calculo = calcularColetaFuraFura({
    quantidadeFuros: Number(body.quantidade_furos) || 0,
    precoFuro,
    comissaoPercentual:
      body.comissao_percentual != null && body.comissao_percentual !== ""
        ? Number(body.comissao_percentual)
        : Number(ponto.comissao_percentual ?? 0),
    desconto: Number(body.desconto) || 0,
    brindes,
    valorPagoRecebido: Number(body.valor_pago_recebido) || 0,
  });

  if (calculo.quantidadeFuros <= 0) {
    return NextResponse.json({ error: "Informe a quantidade de furos." }, { status: 400 });
  }

  if (!body.foto_url) {
    return NextResponse.json({ error: "Foto da máquina é obrigatória." }, { status: 400 });
  }

  if (calculo.valorPagoRecebido > calculo.valorAReceber + 0.009) {
    return NextResponse.json(
      { error: "Valor recebido não pode ser maior que o a receber." },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const coletaInsert = {
    empresa_id: profile.empresa_id,
    ponto_id: pontoId,
    operador_id: user?.id ?? null,
    nicho_modulo: NICHO_MODULO_FURA_FURA,
    quantidade_furos: calculo.quantidadeFuros,
    preco_furo: calculo.precoFuro,
    valor_bruto: calculo.valorBruto,
    comissao_percentual: calculo.comissaoPercentual,
    valor_comissao: calculo.valorComissao,
    valor_liquido: calculo.lucroReal,
    valor_pago_ponto: calculo.valorComissao,
    desconto: calculo.desconto,
    valor_a_receber: calculo.valorAReceber,
    valor_pago_recebido: calculo.valorPagoRecebido,
    custo_brindes: calculo.custoBrindes,
    lucro_real: calculo.lucroReal,
    brindes_entregues: brindes,
    brindes_repostos: body.brindes_repostos ? Number(body.brindes_repostos) : null,
    brindes_restantes: body.brindes_restantes ? Number(body.brindes_restantes) : null,
    forma_pagamento: body.forma_pagamento ?? "dinheiro",
    foto_url: body.foto_url ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    relatorio_enviado: Boolean(body.relatorio_enviado),
    observacao: body.observacao ?? null,
  };

  const { data: coleta, error: coletaError } = await supabase
    .from("coletas")
    .insert(coletaInsert)
    .select("id")
    .single();

  if (coletaError || !coleta) {
    const msg = coletaError?.message ?? "Erro ao registrar coleta.";
    const needsMigration =
      msg.includes("nicho_modulo") ||
      msg.includes("valor_a_receber") ||
      msg.includes("schema cache");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/fura-fura-coletas.sql no Supabase SQL Editor."
          : msg,
      },
      { status: 500 }
    );
  }

  const pontoUpdates: Record<string, unknown> = {
    ultima_coleta: new Date().toISOString(),
  };

  if (ponto.furos_estoque != null) {
    pontoUpdates.furos_estoque = Math.max(
      0,
      Number(ponto.furos_estoque) - calculo.quantidadeFuros
    );
  }

  if (brindes.length > 0 && Array.isArray(ponto.estoque_brindes)) {
    pontoUpdates.estoque_brindes = deduzirEstoquePonto(
      ponto.estoque_brindes as EstoqueBrindePonto[],
      brindes
    );
  }

  await supabase.from("pontos").update(pontoUpdates).eq("id", pontoId);

  if (calculo.valorPagoRecebido > 0.009) {
    await supabase.from("coleta_pagamentos").insert({
      empresa_id: profile.empresa_id,
      coleta_id: coleta.id,
      ponto_id: pontoId,
      valor: calculo.valorPagoRecebido,
      forma_pagamento: body.forma_pagamento ?? "dinheiro",
      observacao: "Pagamento na coleta",
      operador_id: user?.id ?? null,
    });

    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: "entrada",
      categoria: "Coleta fura-fura",
      valor: calculo.valorPagoRecebido,
      descricao: `Coleta ${ponto.nome}`,
      forma_pagamento: body.forma_pagamento ?? "dinheiro",
      ponto_id: pontoId,
      coleta_id: coleta.id,
      operador_id: user?.id ?? null,
    });
  }

  if (calculo.saldoPendente > 0.009) {
    await supabase.from("pendencias").insert({
      empresa_id: profile.empresa_id,
      ponto_id: pontoId,
      coleta_id: coleta.id,
      tipo: calculo.valorPagoRecebido > 0.009 ? "parcial" : "pagamento_pendente",
      titulo: "Coleta fura-fura pendente",
      descricao: `Saldo da coleta de ${new Date().toLocaleDateString("pt-BR")} — ${ponto.nome}`,
      valor: calculo.saldoPendente,
      prioridade: "media",
      status: "aberta",
    });
  }

  return NextResponse.json({
    success: true,
    id: coleta.id,
    calculo,
    ponto: { nome: ponto.nome, whatsapp: ponto.whatsapp },
  });
}
