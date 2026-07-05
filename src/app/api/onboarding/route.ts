import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limiteFromFaixa, normalizeFaixaPontos } from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nome_operacao,
      nicho,
      quantidade_pontos,
      possui_funcionarios,
      objetivo_principal,
    } = body;

    if (
      !nome_operacao ||
      !nicho ||
      !quantidade_pontos ||
      possui_funcionarios === undefined ||
      possui_funcionarios === null ||
      !objetivo_principal
    ) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sessão expirada. Saia e entre de novo." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completo, empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.empresa_id) {
      if (!profile.onboarding_completo) {
        await supabase
          .from("profiles")
          .update({ onboarding_completo: true })
          .eq("user_id", user.id);
      }
      return NextResponse.json({ success: true, empresa_id: profile.empresa_id });
    }

    const { data: empresaId, error: rpcError } = await supabase.rpc(
      "complete_onboarding",
      {
        p_nome_operacao: nome_operacao,
        p_nicho: nicho as Nicho,
        p_quantidade_pontos: quantidade_pontos,
        p_possui_funcionarios: Boolean(possui_funcionarios),
        p_objetivo_principal: objetivo_principal,
      }
    );

    if (!rpcError && empresaId) {
      const { data: verified } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (verified?.empresa_id) {
        return NextResponse.json({ success: true, empresa_id: verified.empresa_id });
      }
    }

    if (rpcError) {
      console.error("RPC error:", rpcError);
      if (rpcError.message.includes("not_authenticated")) {
        return NextResponse.json(
          { error: "Sessão expirada. Saia e entre de novo." },
          { status: 401 }
        );
      }
      if (!rpcError.message.includes("Could not find the function")) {
        return NextResponse.json(
          { error: `Erro ao salvar: ${rpcError.message}` },
          { status: 500 }
        );
      }
    }

    // Fallback manual (se RPC não existir)

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: user.id,
        nome: user.user_metadata?.nome ?? user.email ?? "Usuário",
        email: user.email ?? "",
        trial_inicio: new Date().toISOString(),
        trial_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        assinatura_ativa: true,
      });
    }

    const faixa = normalizeFaixaPontos(quantidade_pontos);
    const limitePontos = limiteFromFaixa(faixa);

    const { error: insertError } = await supabase.from("empresas").insert({
      owner_id: user.id,
      nome_operacao,
      nicho: nicho as Nicho,
      quantidade_pontos: faixa,
      possui_funcionarios: Boolean(possui_funcionarios),
      objetivo_principal,
      plano: "start",
      limite_pontos: limitePontos,
      limite_usuarios: 1,
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Erro ao salvar empresa: ${insertError.message}` },
        { status: 500 }
      );
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!empresa) {
      return NextResponse.json(
        {
          error:
            "Empresa criada mas não encontrada. Rode supabase/onboarding-rpc.sql no Supabase.",
        },
        { status: 500 }
      );
    }

    await supabase.from("empresa_nichos").upsert(
      [
        { empresa_id: empresa.id, nicho: nicho as Nicho, ativo: true },
        { empresa_id: empresa.id, nicho: "outros", ativo: true },
      ],
      { onConflict: "empresa_id,nicho" }
    );

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_completo: true,
        nicho: nicho as Nicho,
        nome_operacao,
        empresa_id: empresa.id,
        plano: "start",
        assinatura_ativa: true,
      })
      .eq("user_id", user.id);

    if (profileError) {
      return NextResponse.json(
        { error: `Erro ao atualizar perfil: ${profileError.message}` },
        { status: 500 }
      );
    }

    await supabase.from("equipe").insert({
      empresa_id: empresa.id,
      user_id: user.id,
      nome: user.user_metadata?.nome ?? user.email ?? "Admin",
      email: user.email,
      role: "admin",
      status: "ativo",
    });

    const { data: verified } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!verified?.empresa_id) {
      return NextResponse.json(
        { error: "Salvo parcialmente. Rode onboarding-rpc.sql no Supabase e tente de novo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, empresa_id: verified.empresa_id });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json(
      { error: "Erro interno. Rode supabase/onboarding-rpc.sql no Supabase." },
      { status: 500 }
    );
  }
}
