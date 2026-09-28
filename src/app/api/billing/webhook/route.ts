import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fetchMpPayment, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { ativarCheckoutPago, type CheckoutRow } from "@/lib/billing/ativar-pagamento";
import {
  ehModeloAssinatura,
  processarAuthorizedPayment,
  processarPreapproval,
  registrarCobrancaAssinatura,
} from "@/lib/billing/assinatura-recorrente";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { PLANOS_PADRAO } from "@/lib/pricing";
import { verifyMercadoPagoWebhook } from "@/lib/security/guards";

export const runtime = "nodejs";

type Topico = "payment" | "preapproval" | "authorized_payment" | "outro";

function classificarTopico(raw: string | null | undefined): Topico {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t || t === "payment") return "payment";
  if (t === "subscription_preapproval" || t === "preapproval") return "preapproval";
  if (t === "subscription_authorized_payment" || t === "authorized_payment") {
    return "authorized_payment";
  }
  return "outro";
}

function assertWebhookSignature(request: Request, resourceId: string) {
  const ok = verifyMercadoPagoWebhook({ request, paymentId: resourceId });
  if (ok === false) {
    return NextResponse.json({ ok: false, error: "Assinatura inválida." }, { status: 401 });
  }
  // ok === null → secret não configurado (legado); ok === true → válido
  return null;
}

async function carregarPlanos(admin: ReturnType<typeof createAdminClient>) {
  const precos = await loadPrecosPayload(admin);
  return precos.planos?.length ? precos.planos : PLANOS_PADRAO;
}

async function processPaymentId(paymentId: string) {
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
  const metodo = [payment.payment_type_id, payment.payment_method_id]
    .filter(Boolean)
    .join("/");

  // Cobrança da recorrência pode chegar como "payment" apontando para o modelo da assinatura.
  const modelo = await ehModeloAssinatura(admin, checkoutId);
  if (modelo) {
    if (!modelo.mp_preapproval_id) {
      return { ok: false as const, error: "Assinatura sem preapproval vinculado." };
    }
    return registrarCobrancaAssinatura(admin, {
      modelo,
      preapprovalId: modelo.mp_preapproval_id,
      paymentId: String(payment.id),
      valorCentavos:
        payment.transaction_amount != null
          ? Math.round(Number(payment.transaction_amount) * 100)
          : null,
      metodo: metodo ? `mercado_pago:${metodo}` : "mercado_pago:assinatura",
      planos: await carregarPlanos(admin),
    });
  }

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

  return ativarCheckoutPago(admin, {
    checkout: checkout as CheckoutRow,
    paymentId: String(payment.id),
    mpStatus: payment.status,
    metodo: metodo ? `mercado_pago:${metodo}` : "mercado_pago",
    planos: await carregarPlanos(admin),
  });
}

async function processar(topico: Topico, resourceId: string) {
  if (!isAdminConfigured() || !isMercadoPagoConfigured()) {
    return { ok: false as const, error: "Billing não configurado." };
  }
  if (topico === "preapproval") {
    return processarPreapproval(createAdminClient(), resourceId);
  }
  if (topico === "authorized_payment") {
    const admin = createAdminClient();
    return processarAuthorizedPayment(admin, resourceId, await carregarPlanos(admin));
  }
  return processPaymentId(resourceId);
}

function responder(result: Awaited<ReturnType<typeof processar>>) {
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
}

/**
 * Webhook / IPN do Mercado Pago.
 * Configure em: https://www.mercadopago.com.br/developers/panel/app
 * URL: https://www.operaroute.com.br/api/billing/webhook
 * Eventos: Pagamentos + Planos e assinaturas.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let resourceId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "";
    let topicoRaw =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      "";

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        type?: string;
        topic?: string;
        data?: { id?: string | number };
      } | null;
      if (body?.data?.id != null) resourceId = String(body.data.id);
      if (body?.type || body?.topic) topicoRaw = String(body.type || body.topic);
    } else if (!resourceId) {
      const form = await request.formData().catch(() => null);
      if (form) {
        resourceId = String(form.get("data.id") || form.get("id") || "");
      }
    }

    const topico = classificarTopico(topicoRaw);
    if (topico === "outro") {
      return NextResponse.json({ ok: true, ignored: topicoRaw });
    }
    if (!resourceId) {
      return NextResponse.json({ ok: true, empty: true });
    }

    const denied = assertWebhookSignature(request, resourceId);
    if (denied) return denied;

    return responder(await processar(topico, resourceId));
  } catch (err) {
    console.error("[billing/webhook]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/** IPN antigo (GET) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const topico = classificarTopico(url.searchParams.get("topic") || url.searchParams.get("type"));
  const id = url.searchParams.get("id") || url.searchParams.get("data.id");

  if (topico === "outro") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!id) return NextResponse.json({ ok: true, empty: true });

  const denied = assertWebhookSignature(request, id);
  if (denied) return denied;

  return responder(await processar(topico, id));
}
