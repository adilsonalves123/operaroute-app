import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "or_dono_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 dias

function secret(): string {
  const s =
    process.env.DONO_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!s || s.length < 16) {
    throw new Error(
      "Configure DONO_SESSION_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) no .env.local"
    );
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export type DonoSession = {
  email: string;
  exp: number;
};

export function getDonoCredentials(): { email: string; password: string } | null {
  const email = process.env.DONO_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.DONO_PASSWORD ?? "";
  if (!email || !password) return null;
  return { email, password };
}

export function verifyDonoPassword(email: string, password: string): boolean {
  const cred = getDonoCredentials();
  if (!cred) return false;
  const e = email.trim().toLowerCase();
  if (e !== cred.email) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(cred.password);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createDonoToken(email: string): string {
  const payload: DonoSession = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function parseDonoToken(token: string | undefined | null): DonoSession | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const expected = sign(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as DonoSession;
    if (!payload?.email || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function donoCookieName() {
  return COOKIE;
}

export function donoCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}
