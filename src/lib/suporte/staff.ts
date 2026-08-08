import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";

/** Staff da plataforma OperaRoute (você) — vê inbox cross-tenant. */
export function isSuporteStaff(user: User | null | undefined, profile?: Profile | null): boolean {
  if (!user) return false;

  const ids = (process.env.SUPORTE_STAFF_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.includes(user.id)) return true;

  const emails = (process.env.SUPORTE_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = (user.email ?? profile?.email ?? "").trim().toLowerCase();
  if (email && emails.includes(email)) return true;

  return false;
}
