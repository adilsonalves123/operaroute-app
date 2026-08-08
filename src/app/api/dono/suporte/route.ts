import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { SuporteConversa } from "@/lib/suporte/types";

export async function GET(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const url = new URL(request.url);
  const modo = url.searchParams.get("modo") ?? "humano";

  const admin = createAdminClient();
  let q = admin
    .from("suporte_conversas")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (modo === "humano") {
    q = q.eq("modo", "humano");
  } else if (modo === "abertos") {
    q = q.in("modo", ["ia", "humano"]);
  } else if (modo === "resolvido") {
    q = q.eq("modo", "resolvido");
  }
  // modo=todos → sem filtro de modo


  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversas = (data as SuporteConversa[]) ?? [];
  const empresaIds = [...new Set(conversas.map((c) => c.empresa_id).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (empresaIds.length) {
    const { data: empresas } = await admin
      .from("empresas")
      .select("id, nome_operacao")
      .in("id", empresaIds);
    for (const e of empresas ?? []) {
      nomes.set(e.id, e.nome_operacao);
    }
  }

  return NextResponse.json({
    conversas: conversas.map((c) => ({
      ...c,
      empresa_nome: nomes.get(c.empresa_id) ?? null,
    })),
  });
}
