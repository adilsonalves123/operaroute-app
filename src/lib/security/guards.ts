import { createHmac, timingSafeEqual } from "crypto";

/**
 * Limite simples em memória (por instância). Suficiente para edge/node single.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimitOk(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Paths internos seguros para redirect pós-login (anti open-redirect). */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  const raw = String(next ?? "").trim() || fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\") || raw.includes("@")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return fallback;
  return raw;
}

/**
 * Valida webhook Mercado Pago (x-signature).
 * Se MP_WEBHOOK_SECRET não estiver setado, retorna null (legado — não quebra billing).
 */
export function verifyMercadoPagoWebhook(opts: {
  request: Request;
  paymentId: string;
}): boolean | null {
  const secret =
    process.env.MP_WEBHOOK_SECRET?.trim() ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ||
    "";
  if (!secret) return null;

  const xSignature = opts.request.headers.get("x-signature") ?? "";
  const xRequestId = opts.request.headers.get("x-request-id") ?? "";
  if (!xSignature || !opts.paymentId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k?.trim() ?? "", rest.join("=").trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${opts.paymentId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
