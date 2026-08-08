import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Verifica se e-mail já existe em profiles (antes do OTP). */
export async function POST(req: Request) {
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

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ existe: Boolean(data) });
}
