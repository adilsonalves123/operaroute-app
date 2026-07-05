import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: equipamento, error: eqError } = await supabase
    .from("equipamentos")
    .select("id, nome, numero_maquina, ponto_id")
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (eqError) {
    return NextResponse.json({ error: eqError.message }, { status: 500 });
  }

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("equipamentos")
    .delete()
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const nome =
    equipamento.numero_maquina && equipamento.nome
      ? `Nº ${equipamento.numero_maquina} · ${equipamento.nome}`
      : equipamento.nome;

  return NextResponse.json({
    success: true,
    mensagem: `${nome} removido do ponto. O histórico de coletas antigas permanece no sistema.`,
  });
}
