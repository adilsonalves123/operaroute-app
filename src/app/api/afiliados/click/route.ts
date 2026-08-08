import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  findAfiliadoByCodigo,
  registrarEventoAfiliado,
} from "@/lib/afiliados/core";

/** Público — registra clique no link do afiliado. */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false });
  }
  const body = await request.json().catch(() => ({}));
  const codigo = String(body.codigo ?? "").trim();
  if (!codigo) {
    return NextResponse.json({ error: "codigo obrigatório." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const afiliado = await findAfiliadoByCodigo(admin, codigo);
    if (!afiliado) {
      return NextResponse.json({ ok: false, found: false });
    }
    await registrarEventoAfiliado(admin, {
      afiliado_id: afiliado.id,
      tipo: "click",
      meta: { codigo: afiliado.codigo },
    });
    return NextResponse.json({ ok: true, found: true, codigo: afiliado.codigo });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
