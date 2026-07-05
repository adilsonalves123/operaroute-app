import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

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
  const pontoDestinoId = String(body.ponto_destino_id ?? "").trim();

  if (!pontoDestinoId) {
    return NextResponse.json({ error: "Selecione o ponto de destino." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, ponto_id, nome, numero_maquina, observacao")
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (eqError) {
    return NextResponse.json({ error: eqError.message }, { status: 500 });
  }

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  if (equipamento.ponto_id === pontoDestinoId) {
    return NextResponse.json(
      { error: "O equipamento já está neste ponto." },
      { status: 400 }
    );
  }

  const [{ data: pontoOrigem }, { data: pontoDestino }] = await Promise.all([
    supabase
      .from("pontos")
      .select("id, nome")
      .eq("id", equipamento.ponto_id)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle(),
    supabase
      .from("pontos")
      .select("id, nome")
      .eq("id", pontoDestinoId)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle(),
  ]);

  if (!pontoDestino) {
    return NextResponse.json({ error: "Ponto de destino não encontrado." }, { status: 404 });
  }

  const dataStr = new Date().toLocaleDateString("pt-BR");
  const linhaTransferencia = `Transferido de ${pontoOrigem?.nome ?? "ponto anterior"} para ${pontoDestino.nome} em ${dataStr}`;
  const observacaoAtualizada = equipamento.observacao
    ? `${equipamento.observacao}\n${linhaTransferencia}`
    : linhaTransferencia;

  const { error: updateError } = await supabase
    .from("equipamentos")
    .update({
      ponto_id: pontoDestinoId,
      observacao: observacaoAtualizada,
    })
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ponto_destino: pontoDestino,
    mensagem: `${equipamento.numero_maquina ? `Nº ${equipamento.numero_maquina} · ` : ""}${equipamento.nome} transferido para ${pontoDestino.nome}. Leituras mantidas. Pendências do ponto de origem permanecem.`,
  });
}
