import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canUseEquipamentoTipo, resolveNichosAtivos } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { parseLeituraContador } from "@/lib/equipamentos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pontoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id")
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado" }, { status: 404 });
  }

  if (!body.nome?.trim() || !body.numero_maquina?.trim() || !body.tipo) {
    return NextResponse.json(
      { error: "Número, nome e tipo são obrigatórios" },
      { status: 400 }
    );
  }

  const tipo = body.tipo as EquipamentoTipo;

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

  if (!canUseEquipamentoTipo(nichosAtivos, tipo)) {
    return NextResponse.json(
      {
        error: "Nicho não contratado para este tipo de equipamento. Veja /planos.",
        nicho_bloqueado: true,
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: pontoId,
      nome: body.nome.trim(),
      numero_maquina: body.numero_maquina.trim(),
      tipo,
      numero_entrada:
        tipo === "cassino" && body.numero_entrada
          ? parseLeituraContador(String(body.numero_entrada))
          : null,
      numero_saida:
        tipo === "cassino" && body.numero_saida
          ? parseLeituraContador(String(body.numero_saida))
          : null,
      entrada_atual:
        tipo === "vending_ursinho" && body.entrada_atual
          ? parseLeituraContador(String(body.entrada_atual))
          : null,
      observacao: body.observacao || null,
      status: "ativo",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    const needsMigration =
      msg.includes("numero_maquina") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");

    return NextResponse.json(
      {
        error: needsMigration
          ? "Coluna numero_maquina não existe no banco. Rode supabase/equipamentos-numero-maquina.sql no Supabase SQL Editor."
          : msg,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, equipamento: data });
}
