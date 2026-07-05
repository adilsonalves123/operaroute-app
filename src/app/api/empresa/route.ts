import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let profile = await getProfile();

  if (profile?.empresa_id) {
    return NextResponse.json({
      empresa_id: profile.empresa_id,
      onboarding_completo: profile.onboarding_completo,
    });
  }

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empresaError) {
    return NextResponse.json({ error: empresaError.message }, { status: 500 });
  }

  if (!empresa) {
    return NextResponse.json(
      {
        error: "Nenhuma empresa encontrada",
        needs_onboarding: true,
      },
      { status: 404 }
    );
  }

  await supabase
    .from("profiles")
    .update({
      empresa_id: empresa.id,
      onboarding_completo: true,
    })
    .eq("user_id", user.id);

  return NextResponse.json({
    empresa_id: empresa.id,
    onboarding_completo: true,
    synced: true,
  });
}
