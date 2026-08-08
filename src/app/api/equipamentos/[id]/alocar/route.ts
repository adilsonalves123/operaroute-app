import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { parseLeituraContador } from "@/lib/equipamentos";

/** Aloca equipamento do estoque central para um ponto. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const pontoId = String(body.ponto_id ?? "").trim();
  const numeroMaquina = String(body.numero_maquina ?? "").trim();

  if (!pontoId) {
    return NextResponse.json({ error: "Selecione o ponto." }, { status: 400 });
  }
  if (!numeroMaquina) {
    return NextResponse.json({ error: "Informe o nº no ponto." }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: equipamento }, { data: ponto }] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("id, ponto_id, nome, observacao, tipo")
      .eq("id", equipamentoId)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle(),
    supabase
      .from("pontos")
      .select("id, nome")
      .eq("id", pontoId)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle(),
  ]);

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }
  if (equipamento.ponto_id) {
    return NextResponse.json(
      { error: "Este equipamento já está alocado em um ponto. Transfira ou devolva ao estoque antes." },
      { status: 400 }
    );
  }
  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  const dataStr = new Date().toLocaleDateString("pt-BR");
  const linha = `Alocado ao ponto ${ponto.nome} (nº ${numeroMaquina}) em ${dataStr}`;
  const observacaoAtualizada = equipamento.observacao
    ? `${equipamento.observacao}\n${linha}`
    : linha;

  const update: Record<string, unknown> = {
    ponto_id: pontoId,
    numero_maquina: numeroMaquina,
    observacao: observacaoAtualizada,
  };

  if (body.numero_entrada != null && String(body.numero_entrada).trim()) {
    update.numero_entrada = parseLeituraContador(String(body.numero_entrada));
  }
  if (body.numero_saida != null && String(body.numero_saida).trim()) {
    update.numero_saida = parseLeituraContador(String(body.numero_saida));
  }
  if (body.entrada_atual != null && String(body.entrada_atual).trim()) {
    update.entrada_atual = parseLeituraContador(String(body.entrada_atual));
  }

  const { data, error } = await supabase
    .from("equipamentos")
    .update(update)
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, equipamento: data });
}
