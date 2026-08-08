import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  aplicarPagamentoFifoColetas,
  distribuirPagamentoFifo,
  NICHO_MODULO_FURA_FURA,
  parseRecebimentoPixDinheiro,
  registrarHaverFuraFura,
  saldoPendenteColeta,
} from "@/lib/nichos/fura-fura";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const pontoId = String(body.ponto_id ?? "").trim();

  if (!pontoId) {
    return NextResponse.json({ error: "Informe o ponto." }, { status: 400 });
  }

  const recebimento = parseRecebimentoPixDinheiro(body);
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const valor = recebimento.data.total;
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

  const { distribuicoes, valorAplicado, valorSobra } =
    pendentes.length > 0
      ? distribuirPagamentoFifo(
          pendentes.map((c) => ({
            id: c.id,
            created_at: c.created_at,
            valor_a_receber: Number(c.valor_a_receber ?? 0),
            valor_pago_recebido: Number(c.valor_pago_recebido ?? 0),
          })),
          valor
        )
      : { distribuicoes: [], valorAplicado: 0, valorSobra: valor };

  if (pendentes.length > 0 && distribuicoes.length === 0 && valorSobra <= 0.009) {
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

  const pixRestante = { v: recebimento.data.pix };
  const dinheiroRestante = { v: recebimento.data.dinheiro };

  const { valorSobra: sobraFinal } = await aplicarPagamentoFifoColetas(supabase, {
    empresaId: profile.empresa_id,
    pontoId,
    pontoNome: ponto?.nome ?? "Ponto",
    coletas: pendentes.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      valor_a_receber: Number(c.valor_a_receber ?? 0),
      valor_pago_recebido: Number(c.valor_pago_recebido ?? 0),
    })),
    valor,
    pixRestante,
    dinheiroRestante,
    formaPagamento: recebimento.data.forma,
    operadorId: user?.id ?? null,
    observacao: body.observacao ?? "Pagamento consolidado",
  });

  let haverGerado = 0;
  if (sobraFinal > 0.009) {
    haverGerado = sobraFinal;
    await registrarHaverFuraFura(supabase, {
      empresaId: profile.empresa_id,
      pontoId,
      pontoNome: ponto?.nome ?? "Ponto",
      valor: sobraFinal,
      valorPix: pixRestante.v,
      valorDinheiro: dinheiroRestante.v,
      motivo: pendentes.length > 0 ? "Pagamento a maior (FIFO)" : "Adiantamento / haver",
      operadorId: user?.id ?? null,
      registrarFinanceiro: true,
    });
  }

  return NextResponse.json({
    success: true,
    valorAplicado,
    valorSobra: sobraFinal,
    haverGerado,
    distribuicoes,
  });
}
