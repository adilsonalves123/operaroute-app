import { absoluteUrl } from "@/lib/app-url";

const MP_API = "https://api.mercadopago.com";

export function getMpAccessToken(): string | null {
  const t = process.env.MP_ACCESS_TOKEN?.trim();
  return t && t.length > 20 ? t : null;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(getMpAccessToken());
}

export type MpPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export type CreatePreferenceInput = {
  checkoutId: string;
  items: MpPreferenceItem[];
  payerEmail?: string | null;
  statementDescriptor?: string;
};

export type CreatePreferenceResult = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

async function mpFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const token = getMpAccessToken();
  if (!token) {
    return { ok: false, status: 503, message: "MP_ACCESS_TOKEN não configurado." };
  }

  try {
    const res = await fetch(`${MP_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }
    if (!res.ok) {
      const msg =
        (json as { message?: string; error?: string })?.message ||
        (json as { error?: string })?.error ||
        `Mercado Pago HTTP ${res.status}`;
      return { ok: false, status: res.status, message: msg };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Falha de rede no Mercado Pago.",
    };
  }
}

/** Checkout Pro — preferência de pagamento único (mensal ou anual). */
export async function createCheckoutPreference(
  input: CreatePreferenceInput
): Promise<
  { ok: true; preference: CreatePreferenceResult } | { ok: false; status: number; message: string }
> {
  const notificationUrl = absoluteUrl("/api/billing/webhook");
  const body = {
    items: input.items.map((i) => ({
      title: i.title.slice(0, 256),
      quantity: i.quantity,
      unit_price: Math.round(i.unit_price * 100) / 100,
      currency_id: i.currency_id ?? "BRL",
    })),
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    external_reference: input.checkoutId,
    statement_descriptor: (input.statementDescriptor ?? "OPERAROUT").slice(0, 22),
    back_urls: {
      success: absoluteUrl(`/planos?billing=success&checkout=${input.checkoutId}`),
      failure: absoluteUrl(`/planos?billing=failure&checkout=${input.checkoutId}`),
      pending: absoluteUrl(`/planos?billing=pending&checkout=${input.checkoutId}`),
    },
    auto_return: "approved" as const,
    notification_url: notificationUrl,
    metadata: {
      checkout_id: input.checkoutId,
      source: "operaroute",
    },
  };

  const result = await mpFetch<CreatePreferenceResult>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) return result;
  if (!result.data?.id || !result.data?.init_point) {
    return { ok: false, status: 500, message: "Preferência criada sem init_point." };
  }
  return { ok: true, preference: result.data };
}

export type MpPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  payment_type_id?: string;
  payment_method_id?: string;
  metadata?: { checkout_id?: string };
};

export async function fetchMpPayment(
  paymentId: string | number
): Promise<{ ok: true; payment: MpPayment } | { ok: false; status: number; message: string }> {
  const result = await mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
  if (!result.ok) return result;
  return { ok: true, payment: result.data };
}
