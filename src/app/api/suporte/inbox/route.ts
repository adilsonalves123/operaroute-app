import { NextResponse } from "next/server";
import { getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSuporteStaff } from "@/lib/suporte/staff";
import type { SuporteConversa } from "@/lib/suporte/types";

export async function GET(request: Request) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isSuporteStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissão de staff." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária para a inbox." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const modo = url.searchParams.get("modo") ?? "humano";

  const admin = createAdminClient();
  let q = admin
    .from("suporte_conversas")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(80);

  if (modo === "humano") {
    q = q.eq("modo", "humano");
  } else if (modo === "abertos") {
    q = q.in("modo", ["ia", "humano"]);
  } else if (modo === "resolvido") {
    q = q.eq("modo", "resolvido");
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversas: (data as SuporteConversa[]) ?? [] });
}
