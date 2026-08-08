import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import {
  COOKIE_SIMULAR_TRIAL,
  parseModoSimularTrial,
  type ModoSimularTrial,
} from "@/lib/assinatura-simulacao";

export async function POST(request: Request) {
  const auth = await requireAcesso("configuracoes", "editar");
  if (!auth.ok) return auth.response;

  let body: { modo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const modo = parseModoSimularTrial(body.modo) as ModoSimularTrial;
  const res = NextResponse.json({ success: true, modo });

  if (modo === "off") {
    res.cookies.set(COOKIE_SIMULAR_TRIAL, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      httpOnly: false,
    });
  } else {
    res.cookies.set(COOKIE_SIMULAR_TRIAL, modo, {
      path: "/",
      maxAge: 60 * 60 * 4, // 4h
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return res;
}
