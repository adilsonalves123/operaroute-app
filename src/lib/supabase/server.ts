import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return null;

  if (profile.empresa_id) return profile;

  // Fallback: sincroniza empresa_id se onboarding criou empresa mas não atualizou profile
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empresa?.id) {
    const { data: updated } = await supabase
      .from("profiles")
      .update({ empresa_id: empresa.id, onboarding_completo: true })
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    return updated ?? { ...profile, empresa_id: empresa.id, onboarding_completo: true };
  }

  return profile;
}

export async function getEmpresaNichos(empresaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_nichos")
    .select("nicho")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error || !data?.length) return null;
  return data.map((row) => row.nicho);
}

export async function getEmpresa(empresaId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", empresaId)
    .single();

  if (!data) return null;

  const nichos = await getEmpresaNichos(empresaId);
  return {
    ...data,
    nichos_ativos: nichos ?? [data.nicho, "outros"],
  };
}
