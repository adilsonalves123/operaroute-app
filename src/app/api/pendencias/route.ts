import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  if (!body.ponto_id || body.valor == null || !body.tipo) {
    return NextResponse.json({ error: "Ponto, tipo e valor são obrigatórios." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pendencias")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      tipo: body.tipo,
      titulo: body.titulo ?? "Pendência manual",
      descricao: body.descricao ?? null,
      valor: parseFloat(body.valor),
      status: "aberta",
      prioridade: body.prioridade ?? "media",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
