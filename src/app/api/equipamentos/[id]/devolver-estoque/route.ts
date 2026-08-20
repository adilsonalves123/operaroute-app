import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { devolverTodoEstoqueMaquinaParaPonto } from "@/lib/estoque/transferir-maquina";

/** Devolve equipamento ao estoque central (ponto_id = null). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipamentoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: equipamento } = await supabase
    .from("equipamentos")
    .select("id, ponto_id, nome, observacao")
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!equipamento) {
    return NextResponse.json({ error: "Equipamento não encontrado." }, { status: 404 });
  }

  if (!equipamento.ponto_id) {
    return NextResponse.json(
      { error: "Este equipamento já está no estoque central." },
      { status: 400 }
    );
  }

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("id", equipamento.ponto_id)
    .maybeSingle();

  // Se o ponto sumiu, ainda assim devolve a máquina ao estoque (não deixa órfã).
  const devolucao = await devolverTodoEstoqueMaquinaParaPonto(supabase, {
    empresaId: profile.empresa_id,
    equipamentoId,
    limparSeFalhar: !ponto,
  });

  if (devolucao.error && ponto) {
    return NextResponse.json(
      { error: `Não foi possível devolver brindes ao ponto: ${devolucao.error}` },
      { status: 500 }
    );
  }

  const dataStr = new Date().toLocaleDateString("pt-BR");
  const linha = `Devolvido ao estoque central (saiu de ${ponto?.nome ?? "ponto"}) em ${dataStr}`;
  const observacaoAtualizada = equipamento.observacao
    ? `${equipamento.observacao}\n${linha}`
    : linha;

  const { data, error } = await supabase
    .from("equipamentos")
    .update({
      ponto_id: null,
      numero_maquina: null,
      observacao: observacaoAtualizada,
    })
    .eq("id", equipamentoId)
    .eq("empresa_id", profile.empresa_id)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("null value") || msg.includes("not-null")) {
      return NextResponse.json(
        {
          error:
            "Rode supabase/equipamentos-estoque-central.sql no Supabase (libera estoque sem ponto).",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true, equipamento: data });
}
