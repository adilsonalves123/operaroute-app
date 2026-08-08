import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { MULTIPLICADOR_ANUAL_PADRAO, PLANOS_PADRAO } from "@/lib/pricing";

/** Público — planos atuais para /planos e onboarding */
export async function GET() {
  if (!isAdminConfigured()) {
    return NextResponse.json({
      planos: PLANOS_PADRAO,
      multiplicador_anual: MULTIPLICADOR_ANUAL_PADRAO,
      fonte: "padrao",
    });
  }

  try {
    const admin = createAdminClient();
    const data = await loadPrecosPayload(admin);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      planos: PLANOS_PADRAO,
      multiplicador_anual: MULTIPLICADOR_ANUAL_PADRAO,
      fonte: "padrao",
    });
  }
}
