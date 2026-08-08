import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { parseRecebimentoPixDinheiro } from "@/lib/nichos/fura-fura/recebimento-pagamento";
import { finalizarVisitaPontoComCheckout } from "@/lib/visitas-ponto/checkout";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const recebimento = parseRecebimentoPixDinheiro(body);
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const desconto = Math.max(0, Number(body.desconto) || 0);
  const somenteFechar =
    body.somente_fechar === true || body.pagamento_ja_aplicado === true;
  const descontarHaver = body.descontar_haver === true;
  const incluirDivida = body.incluir_divida !== false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const resultado = await finalizarVisitaPontoComCheckout(supabase, {
      empresaId: profile.empresa_id,
      visitaPontoId: id,
      desconto,
      pix: recebimento.data.pix,
      dinheiro: recebimento.data.dinheiro,
      operadorId: user?.id ?? null,
      somenteFechar,
      descontarHaver,
      incluirDivida,
    });

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "visita_ponto.finalizar",
      tabela: "visitas_ponto",
      registroId: id,
      dadosNovos: {
        desconto,
        pix: recebimento.data.pix,
        dinheiro: recebimento.data.dinheiro,
        ...(("total" in resultado && resultado) || {}),
      },
      severidade: "medium",
      categoria: "financeiro",
      modulo: "coletas",
      titulo: "Finalizou visita no ponto (checkout)",
      resumo: `Pix R$ ${recebimento.data.pix.toFixed(2)} · Dinheiro R$ ${recebimento.data.dinheiro.toFixed(2)}${desconto ? ` · desconto R$ ${desconto.toFixed(2)}` : ""}`,
      request,
    });

    return NextResponse.json({ success: true, ...resultado });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao finalizar visita." },
      { status: 400 }
    );
  }
}
