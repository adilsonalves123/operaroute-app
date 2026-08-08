import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";
import { isSuporteStaff } from "@/lib/suporte/staff";

/** Dono / staff OperaRoute — painel /plataforma + inbox suporte. */
export function isPlataformaStaff(
  user: User | null | undefined,
  profile?: Profile | null
): boolean {
  return isSuporteStaff(user, profile);
}
