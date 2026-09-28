import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import {
  MULTIPLICADOR_ANUAL_PADRAO,
  PESO_PRECO_NICHOS,
  PLANOS_PADRAO,
} from "@/lib/pricing";

const PADRAO = {
  planos: PLANOS_PADRAO,
  multiplicador_anual: MULTIPLICADOR_ANUAL_PADRAO,
  pesos_nichos: PESO_PRECO_NICHOS,
  fonte: "padrao",
};

/** Público — planos atuais para /planos e onboarding */
export async function GET() {
  if (!isAdminConfigured()) {
    return NextResponse.json(PADRAO);
  }

  try {
    const admin = createAdminClient();
    const data = await loadPrecosPayload(admin);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(PADRAO);
  }
}
