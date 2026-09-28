import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { processarPreapproval } from "@/lib/billing/assinatura-recorrente";

/** Retorno do Mercado Pago (back_url): confere o status da assinatura sem esperar o webhook. */
export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  if (!isAdminConfigured() || !isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "Billing não configurado." }, { status: 503 });
  }

  let body: { checkout_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const checkoutId = body.checkout_id?.trim();
  if (!checkoutId) {
    return NextResponse.json({ error: "checkout_id obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: checkout } = await admin
    .from("plataforma_checkout")
    .select("id, empresa_id, mp_preapproval_id")
    .eq("id", checkoutId)
    .maybeSingle();

  if (!checkout || checkout.empresa_id !== auth.profile.empresa_id) {
    return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
  }

  const preapprovalId = checkout.mp_preapproval_id;
  if (!preapprovalId) {
    return NextResponse.json({ ok: false, status: "pending" });
  }

  const result = await processarPreapproval(admin, String(preapprovalId));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
