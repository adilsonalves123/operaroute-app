import { NextResponse } from "next/server";
import { getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isPlataformaStaff } from "@/lib/plataforma/staff";
import { fetchTenantsPlataforma } from "@/lib/plataforma/tenants";

export async function GET(request: Request) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isPlataformaStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissão de plataforma." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  let tenants = await fetchTenantsPlataforma(admin);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const saude = url.searchParams.get("saude");

  if (q) {
    tenants = tenants.filter(
      (t) =>
        t.nome_operacao.toLowerCase().includes(q) ||
        (t.owner_nome ?? "").toLowerCase().includes(q) ||
        (t.owner_email ?? "").toLowerCase().includes(q) ||
        t.id.includes(q)
    );
  }
  if (saude && saude !== "todos") {
    tenants = tenants.filter((t) => t.saude === saude);
  }

  return NextResponse.json({ tenants });
}
