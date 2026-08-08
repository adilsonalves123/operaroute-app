import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchTenantsPlataforma } from "@/lib/plataforma/tenants";

export async function GET(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  let tenants = await fetchTenantsPlataforma(admin);

  // Por padrão esconde shells órfãs (sem dono vinculado) — poluem o CRM.
  const incluirOrfas = urlHasFlag(request, "orfas");
  if (!incluirOrfas) {
    tenants = tenants.filter((t) => t.cliente_real);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const saude = url.searchParams.get("saude");

  if (q) {
    tenants = tenants.filter(
      (t) =>
        t.nome_operacao.toLowerCase().includes(q) ||
        (t.owner_nome ?? "").toLowerCase().includes(q) ||
        (t.owner_email ?? "").toLowerCase().includes(q)
    );
  }
  if (saude && saude !== "todos") {
    tenants = tenants.filter((t) => t.saude === saude);
  }

  return NextResponse.json({ tenants });
}

function urlHasFlag(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key) === "1";
}
