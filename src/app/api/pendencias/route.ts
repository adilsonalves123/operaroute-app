import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";
import { parseMoneyInput } from "@/lib/utils";

const TIPOS_OK = new Set([
  "negativo",
  "pagamento_pendente",
  "parcial",
  "haver",
]);

export async function POST(request: Request) {
  const auth = await requireAcesso("pendencias", "criar");
  if (!auth.ok) return auth.response;

  const { profile } = auth;

  const body = await request.json();
  if (!body.ponto_id || body.valor == null || !body.tipo) {
    return NextResponse.json({ error: "Ponto, tipo e valor são obrigatórios." }, { status: 400 });
  }

  const tipo = String(body.tipo);
  if (!TIPOS_OK.has(tipo)) {
    return NextResponse.json({ error: "Tipo de pendência inválido." }, { status: 400 });
  }

  const valor = parseMoneyInput(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  const tituloPadrao =
    tipo === "haver"
      ? "Haver do ponto"
      : tipo === "pagamento_pendente"
        ? "Pagamento pendente"
        : tipo === "parcial"
          ? "Pagamento parcial"
          : "Pendência manual";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pendencias")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: body.ponto_id,
      tipo,
      titulo: body.titulo ?? tituloPadrao,
      descricao: body.descricao ?? null,
      valor,
      status: "aberta",
      prioridade: body.prioridade ?? (tipo === "haver" ? "baixa" : "media"),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
