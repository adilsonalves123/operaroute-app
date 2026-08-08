import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchMpPayment, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { ativarCheckoutPago, type CheckoutRow } from "@/lib/billing/ativar-pagamento";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { PLANOS_PADRAO } from "@/lib/pricing";

/**
 * Confirma checkout após retorno do MP (quando webhook atrasar).
 * Body: { checkout_id, payment_id? }
 */
export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  if (!isAdminConfigured() || !isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "Billing não configurado." }, { status: 503 });
  }

  let body: { checkout_id?: string; payment_id?: string };
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
  const { data: checkout, error } = await admin
    .from("plataforma_checkout")
    .select(
      "id, empresa_id, ciclo, faixa, nichos, valor_centavos, plano_nome, status, mp_payment_id"
    )
    .eq("id", checkoutId)
    .maybeSingle();

  if (error || !checkout) {
    return NextResponse.json(
      { error: error?.message ?? "Checkout não encontrado." },
      { status: 404 }
    );
  }

  if (checkout.empresa_id !== auth.profile.empresa_id) {
    return NextResponse.json({ error: "Checkout de outra empresa." }, { status: 403 });
  }

  if (checkout.status === "pago") {
    return NextResponse.json({ ok: true, status: "pago", already: true });
  }

  let paymentId = body.payment_id || checkout.mp_payment_id;

  // Se veio só o checkout, tenta buscar pagamentos recentes por external_reference via payment_id na query do return
  if (!paymentId) {
    return NextResponse.json({
      ok: false,
      status: checkout.status,
      message: "Aguardando confirmação do Mercado Pago. O webhook ativa a assinatura em instantes.",
    });
  }

  const pay = await fetchMpPayment(paymentId);
  if (!pay.ok) {
    return NextResponse.json({ error: pay.message }, { status: 502 });
  }

  if (pay.payment.status !== "approved") {
    return NextResponse.json({
      ok: false,
      status: pay.payment.status,
      message: "Pagamento ainda não aprovado.",
    });
  }

  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos?.length ? precos.planos : PLANOS_PADRAO;

  const result = await ativarCheckoutPago(admin, {
    checkout: checkout as CheckoutRow,
    paymentId: String(pay.payment.id),
    mpStatus: pay.payment.status,
    metodo: "mercado_pago",
    planos,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pago" });
}
