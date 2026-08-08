import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { limparMidiaAntigaTodasEmpresas } from "@/lib/relatorios/retencao";

/**
 * Cron semanal: limpa conforme retencao_midia_dias de cada empresa.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const qSecret = url.searchParams.get("secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!secret || (bearer !== secret && qSecret !== secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária para o cron global." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const result = await limparMidiaAntigaTodasEmpresas(admin);

  return NextResponse.json({
    ok: true,
    ...result,
    message:
      "Mídia antiga removida conforme a retenção de cada empresa. Coletas/financeiro preservados.",
  });
}

export async function POST(request: Request) {
  return GET(request);
}
