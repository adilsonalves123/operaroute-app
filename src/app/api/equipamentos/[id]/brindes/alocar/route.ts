import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";
import { alocarBrindePontoParaMaquina } from "@/lib/estoque/transferir-maquina";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const auth = await requireAcesso("pontos", "editar");
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const itemId = String(body.item_id ?? "").trim();
  const quantidade = Math.max(0, Math.floor(Number(body.quantidade) || 0));

  if (!itemId) {
    return NextResponse.json({ error: "Selecione o item." }, { status: 400 });
  }
  if (quantidade <= 0) {
    return NextResponse.json({ error: "Informe a quantidade." }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await alocarBrindePontoParaMaquina(supabase, {
    empresaId: auth.profile.empresa_id!,
    equipamentoId,
    itemId,
    quantidade,
  });

  if (result.error) {
    const status = result.error.includes("não está") ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const { data: equipamento } = await supabase
    .from("equipamentos")
    .select("id, estoque_brindes")
    .eq("id", equipamentoId)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    mensagem: "Brinde alocado na máquina.",
    estoque_brindes: equipamento?.estoque_brindes ?? [],
  });
}
