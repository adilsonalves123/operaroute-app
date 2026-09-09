import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimitOk } from "@/lib/security/guards";

/** Verifica se e-mail já existe em profiles (antes do OTP). */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimitOk(`checar-email:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde." }, { status: 429 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  // Não usa service_role se possível — mas profiles RLS pode bloquear anon.
  // Resposta com timing mais estável: sempre consulta e devolve boolean.
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  // Mantém o contrato { existe } exigido pelo cadastro — com rate limit.
  return NextResponse.json({ existe: Boolean(data) });
}
