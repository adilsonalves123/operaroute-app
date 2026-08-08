/** URL pública canônica do app (usuário, dono, parceiro, e-mails, links). */
export function getAppUrl(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  const fallback = fallbackOrigin?.trim().replace(/\/$/, "");
  if (fallback) return fallback;

  return "http://localhost:3000";
}

export function absoluteUrl(path: string, fallbackOrigin?: string): string {
  const base = getAppUrl(fallbackOrigin);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
