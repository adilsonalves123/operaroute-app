import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAcesso("pendencias", "criar");
  if (!auth.ok) return auth.response;

  const { profile } = auth;

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
