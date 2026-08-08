import { NextResponse } from "next/server";
import {
  createDonoToken,
  donoCookieName,
  donoCookieOptions,
  getDonoCredentials,
  verifyDonoPassword,
} from "@/lib/dono/auth";

export async function POST(request: Request) {
  const cred = getDonoCredentials();
  if (!cred) {
    return NextResponse.json(
      {
        error:
          "Painel do dono não configurado. Adicione DONO_EMAIL e DONO_PASSWORD no .env.local.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!verifyDonoPassword(email, password)) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const token = createDonoToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(donoCookieName(), token, donoCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(donoCookieName(), "", { ...donoCookieOptions(), maxAge: 0 });
  return res;
}
