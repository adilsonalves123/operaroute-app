import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { requestMeta } from "@/lib/auditoria/registrar";

const TIPOS = new Set([
  "visita_login",
  "visita_cadastro",
  "visita_landing",
  "click_cadastro",
]);

/** Público — registra visita ao funil (login/cadastro). */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false }, { status: 204 });
  }

  const body = await request.json().catch(() => ({}));
  const tipo = String(body.tipo ?? "").trim();
  if (!TIPOS.has(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  const meta = requestMeta(request);
  try {
    const admin = createAdminClient();
    await admin.from("plataforma_funil_eventos").insert({
      tipo,
      path: String(body.path ?? "").slice(0, 300) || null,
      referrer: String(body.referrer ?? "").slice(0, 500) || null,
      user_agent: meta.userAgent?.slice(0, 400) ?? null,
      ip: meta.ip,
      meta: body.meta && typeof body.meta === "object" ? body.meta : null,
    });
  } catch {
    // silencioso
  }

  return NextResponse.json({ ok: true });
}
