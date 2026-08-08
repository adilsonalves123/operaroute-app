import { cache } from "react";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import type { Empresa } from "@/lib/types/database";
import type { Profile } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppBootstrap = {
  profile: Profile | null;
  supabase: SupabaseClient;
  empresa: Empresa | null;
};

/** Profile + client + empresa em paralelo (deduplica via cache do server.ts). */
export const getAppBootstrap = cache(async (): Promise<AppBootstrap> => {
  const profile = await getProfile();
  const [supabase, empresa] = await Promise.all([
    createClient(),
    profile?.empresa_id ? getEmpresa(profile.empresa_id) : Promise.resolve(null),
  ]);
  return { profile, supabase, empresa };
});
