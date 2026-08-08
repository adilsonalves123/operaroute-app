import { NextResponse } from "next/server";
import { getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isPlataformaStaff } from "@/lib/plataforma/staff";
import { buildOverview, fetchTenantsPlataforma } from "@/lib/plataforma/tenants";

export async function GET() {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isPlataformaStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissão de plataforma." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária para o painel." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const tenants = await fetchTenantsPlataforma(admin);

  const { count: suporteHumano } = await admin
    .from("suporte_conversas")
    .select("id", { count: "exact", head: true })
    .eq("modo", "humano");

  const overview = buildOverview(tenants, suporteHumano ?? 0);
  return NextResponse.json({ overview, tenants });
}
