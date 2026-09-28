import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { avisarVencimentosAssinatura } from "@/lib/billing/avisar-vencimento";

/**
 * Cron diário: avisa por push quem está com a assinatura perto de vencer (ou venceu ontem).
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária para o cron global." },
      { status: 503 }
    );
  }

  const result = await avisarVencimentosAssinatura(createAdminClient());
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
