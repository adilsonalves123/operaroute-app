import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function sessionSecret(): string {
  const s =
    process.env.DONO_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!s || s.length < 16) {
    throw new Error("Configure DONO_SESSION_SECRET no .env.local");
  }
  return s;
}

export function hashSenhaAfiliado(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenhaAfiliado(senha: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const next = scryptSync(senha, salt, 64);
    const prev = Buffer.from(hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
}

export type AfiliadoSession = {
  afiliado_id: string;
  email: string;
  codigo: string;
  nome: string;
  exp: number;
};

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function createAfiliadoToken(a: {
  id: string;
  email: string;
  codigo: string;
  nome: string;
}): string {
  const payload: AfiliadoSession = {
    afiliado_id: a.id,
    email: a.email.trim().toLowerCase(),
    codigo: a.codigo,
    nome: a.nome,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function parseAfiliadoToken(
  token: string | undefined | null
): AfiliadoSession | null {
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
    ) as AfiliadoSession;
    if (!payload?.afiliado_id || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function afiliadoCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
