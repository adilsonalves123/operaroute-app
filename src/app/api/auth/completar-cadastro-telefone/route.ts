import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164Brasil } from "@/lib/auth/telefone-br";

/**
 * Após OTP por SMS/WhatsApp: grava e-mail+senha confirmados
 * para o usuário poder entrar com e-mail/senha normalmente.
 */
export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    nome?: string;
    whatsapp?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const nome = String(body.nome ?? "").trim();
  const whatsapp = String(body.whatsapp ?? "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }
  if (!toE164Brasil(whatsapp)) {
    return NextResponse.json(
      { error: "WhatsApp inválido. Use DDD + número." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "Confirme o código SMS/WhatsApp antes de continuar." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();

  const { data: emailEmUso } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .neq("user_id", user.id)
    .maybeSingle();

  if (emailEmUso) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado. Faça login ou use outro." },
      { status: 409 }
    );
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome: nome || user.user_metadata?.nome,
      whatsapp,
      confirm_channel: user.user_metadata?.confirm_channel ?? "sms",
    },
  });

  if (updErr) {
    const msg = updErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json(
        { error: "Este e-mail já está em uso em outra conta." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  await admin
    .from("profiles")
    .update({
      nome: nome || undefined,
      email,
      whatsapp,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
