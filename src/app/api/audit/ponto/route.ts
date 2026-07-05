import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

function brl(n: number) {
  return Number(n.toFixed(2));
}

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const nome = searchParams.get("nome") ?? searchParams.get("q") ?? "pulinho";

  const supabase = await createClient();

  const { data: pontos, error: pErr } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("empresa_id", profile.empresa_id)
    .ilike("nome", `%${nome}%`);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  if (!pontos?.length) {
    return NextResponse.json({ error: `Nenhum ponto encontrado para "${nome}"` }, { status: 404 });
  }

  const resultado = [];

  for (const ponto of pontos) {
    const { data: visitas } = await supabase
      .from("visitas")
      .select(
        "id, created_at, saldo_negativo, total_lucro_centavos, desconto, valor_cliente, valor_operacao, valor_operacao_efetivo, valor_pago, debito_abatido, restante, adiantamento_pix, adiantamento_dinheiro"
      )
      .eq("ponto_id", ponto.id)
      .eq("empresa_id", profile.empresa_id)
      .order("created_at", { ascending: true });

    const visitasAudit = [];

    for (const v of visitas ?? []) {
      const lucro = Number(v.total_lucro_centavos) / 100;
      const opEf = Number(v.valor_operacao_efetivo ?? 0);
      const pago = Number(v.valor_pago ?? 0);
      const abatNeg = Number(v.debito_abatido ?? 0);
      const pagoOp = Math.max(0, pago - abatNeg);
      const restOpEsperado = v.saldo_negativo ? 0 : Math.max(0, opEf - pagoOp);

      const { data: pendCriadas } = await supabase
        .from("pendencias")
        .select("id, tipo, titulo, valor, status, descricao")
        .eq("visita_id", v.id)
        .eq("empresa_id", profile.empresa_id);

      visitasAudit.push({
        id: v.id,
        data: v.created_at,
        tipo: v.saldo_negativo ? "negativa" : "positiva",
        lucro: brl(lucro),
        valor_operacao_efetivo: brl(opEf),
        valor_pago: brl(pago),
        debito_abatido_negativo: brl(abatNeg),
        reposto: brl(Number(v.desconto ?? 0)),
        restante_gravado: brl(Number(v.restante ?? 0)),
        restante_operacao_esperado: brl(restOpEsperado),
        pendencias_criadas: (pendCriadas ?? []).map((p) => ({
          id: p.id,
          tipo: p.tipo,
          titulo: p.titulo,
          valor: brl(Number(p.valor ?? 0)),
          status: p.status,
        })),
      });
    }

    const { data: pendencias } = await supabase
      .from("pendencias")
      .select("id, tipo, titulo, valor, status, descricao, visita_id, created_at")
      .eq("ponto_id", ponto.id)
      .eq("empresa_id", profile.empresa_id)
      .order("created_at", { ascending: true });

    const abertas = (pendencias ?? []).filter((p) => p.status === "aberta");
    const negativas = abertas.filter((p) => p.tipo?.toLowerCase() === "negativo");
    const operacao = abertas.filter((p) =>
      ["pagamento_pendente", "parcial"].includes(p.tipo?.toLowerCase() ?? "")
    );

    resultado.push({
      ponto: { id: ponto.id, nome: ponto.nome },
      visitas: visitasAudit,
      pendencias: (pendencias ?? []).map((p) => ({
        id: p.id,
        tipo: p.tipo,
        titulo: p.titulo,
        valor: brl(Number(p.valor ?? 0)),
        status: p.status,
        visita_id: p.visita_id,
        criada: p.created_at,
        descricao_resumo: p.descricao?.split("\n")[0] ?? null,
      })),
      resumo_nova_coleta: {
        negativo_em_aberto: brl(negativas.reduce((s, p) => s + Number(p.valor ?? 0), 0)),
        pagamento_parcial_em_aberto: brl(operacao.reduce((s, p) => s + Number(p.valor ?? 0), 0)),
        detalhe_operacao: operacao.map((p) => ({
          valor: brl(Number(p.valor ?? 0)),
          titulo: p.titulo,
          tipo: p.tipo,
          visita_id: p.visita_id,
        })),
      },
    });
  }

  return NextResponse.json({ audit: resultado });
}
