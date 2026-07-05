import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  distribuirPagamentoFifo,
  NICHO_MODULO_FURA_FURA,
  saldoPendenteColeta,
} from "@/lib/nichos/fura-fura";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const pontoId = String(body.ponto_id ?? "").trim();
  const valor = Number(body.valor) || 0;

  if (!pontoId) {
    return NextResponse.json({ error: "Informe o ponto." }, { status: 400 });
  }
  if (valor <= 0.009) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: coletas, error } = await supabase
    .from("coletas")
    .select("id, created_at, valor_a_receber, valor_pago_recebido")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", pontoId)
    .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
    .order("created_at", { ascending: true });

  if (error) {
    const needsMigration = error.message.includes("nicho_modulo");
    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/fura-fura-coletas.sql no Supabase SQL Editor."
          : error.message,
      },
      { status: 500 }
    );
  }

  const pendentes = (coletas ?? []).filter((c) => saldoPendenteColeta(c) > 0.009);
  if (pendentes.length === 0) {
    return NextResponse.json({ error: "Nenhuma coleta pendente neste ponto." }, { status: 400 });
  }

  const { distribuicoes, valorAplicado, valorSobra } = distribuirPagamentoFifo(
    pendentes.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      valor_a_receber: Number(c.valor_a_receber ?? 0),
      valor_pago_recebido: Number(c.valor_pago_recebido ?? 0),
    })),
    valor
  );

  if (distribuicoes.length === 0) {
    return NextResponse.json({ error: "Nada a aplicar." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("nome")
    .eq("id", pontoId)
    .maybeSingle();

  for (const d of distribuicoes) {
    const col = pendentes.find((c) => c.id === d.coletaId)!;
    const novoPago =
      Math.round((Number(col.valor_pago_recebido ?? 0) + d.valor) * 100) / 100;

    await supabase
      .from("coletas")
      .update({ valor_pago_recebido: novoPago })
      .eq("id", d.coletaId)
      .eq("empresa_id", profile.empresa_id);

    await supabase.from("coleta_pagamentos").insert({
      empresa_id: profile.empresa_id,
      coleta_id: d.coletaId,
      ponto_id: pontoId,
      valor: d.valor,
      forma_pagamento: body.forma_pagamento ?? "dinheiro",
      observacao: body.observacao ?? "Pagamento consolidado",
      operador_id: user?.id ?? null,
    });

    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: "entrada",
      categoria: "Recebimento coleta",
      valor: d.valor,
      descricao: `Pagamento coleta — ${ponto?.nome ?? "Ponto"}`,
      forma_pagamento: body.forma_pagamento ?? "dinheiro",
      ponto_id: pontoId,
      coleta_id: d.coletaId,
      operador_id: user?.id ?? null,
    });

    const novoSaldo = saldoPendenteColeta({
      valor_a_receber: Number(col.valor_a_receber ?? 0),
      valor_pago_recebido: novoPago,
    });

    if (novoSaldo <= 0.009) {
      await supabase
        .from("pendencias")
        .update({ status: "resolvida", valor: 0, resolvido_em: new Date().toISOString() })
        .eq("coleta_id", d.coletaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "aberta");
    } else {
      await supabase
        .from("pendencias")
        .update({ valor: novoSaldo })
        .eq("coleta_id", d.coletaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "aberta");
    }
  }

  return NextResponse.json({
    success: true,
    valorAplicado,
    valorSobra,
    distribuicoes,
  });
}
