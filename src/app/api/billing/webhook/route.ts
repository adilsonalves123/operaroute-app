import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchMpPayment, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { ativarCheckoutPago, type CheckoutRow } from "@/lib/billing/ativar-pagamento";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { PLANOS_PADRAO } from "@/lib/pricing";

export const runtime = "nodejs";

async function processPaymentId(paymentId: string) {
  if (!isAdminConfigured() || !isMercadoPagoConfigured()) {
    return { ok: false as const, error: "Billing não configurado." };
  }

  const pay = await fetchMpPayment(paymentId);
  if (!pay.ok) return { ok: false as const, error: pay.message };

  const payment = pay.payment;
  if (payment.status !== "approved") {
    return { ok: true as const, skipped: true as const, status: payment.status };
  }

  const checkoutId =
    payment.external_reference ||
    payment.metadata?.checkout_id ||
    null;

  if (!checkoutId) {
    return { ok: false as const, error: "Pagamento sem external_reference." };
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
    return {
      ok: false as const,
      error: error?.message ?? "Checkout não encontrado.",
    };
  }

  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos?.length ? precos.planos : PLANOS_PADRAO;

  const metodo = [payment.payment_type_id, payment.payment_method_id]
    .filter(Boolean)
    .join("/");

  return ativarCheckoutPago(admin, {
    checkout: checkout as CheckoutRow,
    paymentId: String(payment.id),
    mpStatus: payment.status,
    metodo: metodo ? `mercado_pago:${metodo}` : "mercado_pago",
    planos,
  });
}

/**
 * Webhook / IPN do Mercado Pago.
 * Configure em: https://www.mercadopago.com.br/developers/panel/app
 * URL: https://www.operaroute.com.br/api/billing/webhook
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "";

    const topic =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      "";

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        type?: string;
        action?: string;
        data?: { id?: string | number };
      } | null;
      if (body?.data?.id != null) paymentId = String(body.data.id);
      if (!topic && body?.type) {
        // topic from body
      }
      const t = body?.type || topic;
      if (t && t !== "payment" && !String(t).includes("payment")) {
        return NextResponse.json({ ok: true, ignored: t });
      }
    } else if (!paymentId) {
      const form = await request.formData().catch(() => null);
      if (form) {
        paymentId = String(form.get("data.id") || form.get("id") || "");
      }
    }

    if (!paymentId) {
      return NextResponse.json({ ok: true, empty: true });
    }

    const result = await processPaymentId(paymentId);
    if (!result.ok) {
      console.error("[billing/webhook]", result.error);
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }
    return NextResponse.json({
      ok: true,
      already: "already" in result ? result.already : undefined,
      skipped: "skipped" in result ? result.skipped : undefined,
      status: "status" in result ? result.status : undefined,
    });
  } catch (err) {
    console.error("[billing/webhook]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/** IPN antigo (GET) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");
  const id = url.searchParams.get("id") || url.searchParams.get("data.id");

  if (topic && topic !== "payment" && !topic.includes("payment")) {
    return NextResponse.json({ ok: true, ignored: topic });
  }
  if (!id) return NextResponse.json({ ok: true, empty: true });

  const result = await processPaymentId(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    already: "already" in result ? result.already : undefined,
    skipped: "skipped" in result ? result.skipped : undefined,
    status: "status" in result ? result.status : undefined,
  });
}
