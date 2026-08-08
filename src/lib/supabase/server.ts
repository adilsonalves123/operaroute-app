import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Empresa } from "@/lib/types/database";

const PROFILE_COLUMNS =
  "id, user_id, nome, whatsapp, email, onboarding_completo, nicho, nome_operacao, empresa_id, plano, trial_inicio, trial_fim, assinatura_ativa, created_at";

const EMPRESA_COLUMNS =
  "id, owner_id, nome_operacao, nicho, quantidade_pontos, possui_funcionarios, objetivo_principal, plano, status, limite_pontos, limite_usuarios, created_at";

const getCachedCookieStore = cache(async () => cookies());

export const createClient = cache(async () => {
  const cookieStore = await getCachedCookieStore();

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
});

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const supabase = await createClient();
  const user = await getSession();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
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
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    return updated ?? { ...profile, empresa_id: empresa.id, onboarding_completo: true };
  }

  return profile;
});

export const getEmpresaNichos = cache(async (empresaId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_nichos")
    .select("nicho")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error || !data?.length) return null;
  return data.map((row) => row.nicho);
});

export const getEmpresa = cache(async (empresaId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    .select(EMPRESA_COLUMNS)
    .eq("id", empresaId)
    .single();

  if (!data) return null;

  // Coluna opcional (migration retencao-midia-coleta.sql) — não quebra se ainda não existir
  let retencao_midia_dias: number | null = 90;
  let pesquisa_onboarding: Empresa["pesquisa_onboarding"] = null;
  let assinatura_vence_em: string | null = null;
  let ciclo_cobranca: Empresa["ciclo_cobranca"] = null;
  let chave_pix: string | null = null;
  try {
    const { data: extras, error: extrasErr } = await supabase
      .from("empresas")
      .select(
        "retencao_midia_dias, pesquisa_onboarding, assinatura_vence_em, ciclo_cobranca"
      )
      .eq("id", empresaId)
      .maybeSingle();
    if (!extrasErr && extras) {
      if (typeof extras.retencao_midia_dias === "number") {
        retencao_midia_dias = extras.retencao_midia_dias;
      }
      if (extras.pesquisa_onboarding != null) {
        pesquisa_onboarding = extras.pesquisa_onboarding as Empresa["pesquisa_onboarding"];
      }
      if (extras.assinatura_vence_em != null) {
        assinatura_vence_em = String(extras.assinatura_vence_em);
      }
      if (extras.ciclo_cobranca === "mensal" || extras.ciclo_cobranca === "anual") {
        ciclo_cobranca = extras.ciclo_cobranca;
      }
    }
  } catch {
    retencao_midia_dias = 90;
  }

  // Coluna opcional (empresas-chave-pix.sql)
  if (chave_pix == null) {
    try {
      const { data: pixRow, error: pixErr } = await supabase
        .from("empresas")
        .select("chave_pix")
        .eq("id", empresaId)
        .maybeSingle();
      if (!pixErr && pixRow?.chave_pix != null && String(pixRow.chave_pix).trim()) {
        chave_pix = String(pixRow.chave_pix).trim();
      }
    } catch {
      /* coluna ainda não migrada */
    }
  }

  // Fallback só retencao se select conjunto falhar por coluna pesquisa
  if (pesquisa_onboarding === null) {
    try {
      const { data: ret, error: retErr } = await supabase
        .from("empresas")
        .select("retencao_midia_dias")
        .eq("id", empresaId)
        .maybeSingle();
      if (
        !retErr &&
        ret &&
        typeof (ret as { retencao_midia_dias?: unknown }).retencao_midia_dias === "number"
      ) {
        retencao_midia_dias = (ret as { retencao_midia_dias: number }).retencao_midia_dias;
      }
    } catch {
      retencao_midia_dias = 90;
    }
  }

  const nichos = await getEmpresaNichos(empresaId);
  return {
    ...data,
    retencao_midia_dias,
    pesquisa_onboarding,
    assinatura_vence_em,
    ciclo_cobranca,
    chave_pix,
    nichos_ativos: nichos ?? [data.nicho, "outros"],
  };
});
