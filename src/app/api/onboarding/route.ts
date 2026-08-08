import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { AFILIADO_REF_COOKIE, atribuirAfiliadoEmpresa } from "@/lib/afiliados/core";
import {
  limiteFromFaixa,
  normalizeFaixaPontos,
  slugFromFaixa,
} from "@/lib/pricing";
import { trialFimIso } from "@/lib/assinatura-acesso";
import {
  buildPesquisaOnboarding,
  splitNichosPorPlano,
} from "@/lib/onboarding/pesquisa";
import type { Nicho } from "@/lib/types/database";

async function aplicarRefAfiliado(empresaId: string) {
  if (!isAdminConfigured()) return;
  try {
    const jar = await cookies();
    const ref = jar.get(AFILIADO_REF_COOKIE)?.value;
    if (!ref) return;
    await atribuirAfiliadoEmpresa(createAdminClient(), empresaId, ref);
  } catch {
    // não bloqueia onboarding
  }
}

/** Grava pesquisa + ativa só os nichos liberados pelo plano. */
async function aplicarPesquisaENichos(
  supabase: SupabaseClient,
  empresaId: string,
  opts: {
    quantidade_pontos: string;
    nichosSelecionados: Nicho[];
    possui_funcionarios: boolean;
    nichoPrincipal: Nicho;
  }
) {
  const faixa = normalizeFaixaPontos(opts.quantidade_pontos);
  const pesquisa = buildPesquisaOnboarding({
    quantidade_pontos: faixa,
    nichos: opts.nichosSelecionados,
    possui_funcionarios: opts.possui_funcionarios,
  });
  const { ativar } = splitNichosPorPlano(opts.nichosSelecionados, faixa);
  const nichosAtivos = [...new Set([...ativar, "outros" as Nicho])];
  const nichoPrincipal = nichosAtivos.includes(opts.nichoPrincipal)
    ? opts.nichoPrincipal
    : nichosAtivos[0]!;

  const { error: updErr } = await supabase
    .from("empresas")
    .update({
      pesquisa_onboarding: pesquisa,
      quantidade_pontos: faixa,
      possui_funcionarios: opts.possui_funcionarios,
      nicho: nichoPrincipal,
      plano: slugFromFaixa(faixa),
      limite_pontos: limiteFromFaixa(faixa),
    })
    .eq("id", empresaId);

  if (updErr && /pesquisa_onboarding|schema cache/i.test(updErr.message)) {
    // Coluna ainda não existe — salva o resto e segue
    await supabase
      .from("empresas")
      .update({
        quantidade_pontos: faixa,
        possui_funcionarios: opts.possui_funcionarios,
        nicho: nichoPrincipal,
        plano: slugFromFaixa(faixa),
        limite_pontos: limiteFromFaixa(faixa),
      })
      .eq("id", empresaId);
  }

  await supabase.from("empresa_nichos").upsert(
    nichosAtivos.map((n) => ({
      empresa_id: empresaId,
      nicho: n,
      ativo: true,
    })),
    { onConflict: "empresa_id,nicho" }
  );

  return nichoPrincipal;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nome_operacao,
      nicho,
      nichos,
      quantidade_pontos,
      possui_funcionarios,
      objetivo_principal,
    } = body;

    const nichosSelecionados: Nicho[] = Array.isArray(nichos)
      ? (nichos as Nicho[]).filter(Boolean)
      : nicho
        ? [nicho as Nicho]
        : [];
    const nichoPrincipal = (nicho as Nicho) || nichosSelecionados[0];

    if (
      !nome_operacao ||
      !nichoPrincipal ||
      nichosSelecionados.length === 0 ||
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
      // Atualiza pesquisa se a empresa já existia sem completar
      await aplicarPesquisaENichos(supabase, profile.empresa_id, {
        quantidade_pontos,
        nichosSelecionados,
        possui_funcionarios: Boolean(possui_funcionarios),
        nichoPrincipal,
      });
      return NextResponse.json({ success: true, empresa_id: profile.empresa_id });
    }

    const { data: empresaId, error: rpcError } = await supabase.rpc(
      "complete_onboarding",
      {
        p_nome_operacao: nome_operacao,
        p_nicho: nichoPrincipal,
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
        const nichoOk = await aplicarPesquisaENichos(supabase, verified.empresa_id, {
          quantidade_pontos,
          nichosSelecionados,
          possui_funcionarios: Boolean(possui_funcionarios),
          nichoPrincipal,
        });
        await supabase
          .from("profiles")
          .update({
            nicho: nichoOk,
            nome_operacao,
            // RPC antigo marcava assinatura_ativa=true — força trial correto
            assinatura_ativa: false,
            trial_inicio: new Date().toISOString(),
            trial_fim: trialFimIso(),
          })
          .eq("user_id", user.id);
        await aplicarRefAfiliado(verified.empresa_id);
        return NextResponse.json({
          success: true,
          empresa_id: verified.empresa_id,
        });
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
        trial_fim: trialFimIso(),
        assinatura_ativa: false,
      });
    }

    const faixa = normalizeFaixaPontos(quantidade_pontos);
    const limitePontos = limiteFromFaixa(faixa);
    const pesquisa = buildPesquisaOnboarding({
      quantidade_pontos: faixa,
      nichos: nichosSelecionados,
      possui_funcionarios: Boolean(possui_funcionarios),
    });

    const insertPayload: Record<string, unknown> = {
      owner_id: user.id,
      nome_operacao,
      nicho: nichoPrincipal,
      quantidade_pontos: faixa,
      possui_funcionarios: Boolean(possui_funcionarios),
      objetivo_principal,
      plano: slugFromFaixa(faixa),
      limite_pontos: limitePontos,
      limite_usuarios: 10,
      pesquisa_onboarding: pesquisa,
    };

    let { error: insertError } = await supabase
      .from("empresas")
      .insert(insertPayload);

    if (insertError && /pesquisa_onboarding|schema cache/i.test(insertError.message)) {
      delete insertPayload.pesquisa_onboarding;
      ({ error: insertError } = await supabase.from("empresas").insert(insertPayload));
    }

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

    const nichoOk = await aplicarPesquisaENichos(supabase, empresa.id, {
      quantidade_pontos: faixa,
      nichosSelecionados,
      possui_funcionarios: Boolean(possui_funcionarios),
      nichoPrincipal,
    });

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_completo: true,
        nicho: nichoOk,
        nome_operacao,
        empresa_id: empresa.id,
        plano: slugFromFaixa(faixa),
        assinatura_ativa: false,
        trial_inicio: new Date().toISOString(),
        trial_fim: trialFimIso(),
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
        {
          error:
            "Salvo parcialmente. Rode onboarding-rpc.sql no Supabase e tente de novo.",
        },
        { status: 500 }
      );
    }

    await aplicarRefAfiliado(verified.empresa_id);
    return NextResponse.json({ success: true, empresa_id: verified.empresa_id });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json(
      { error: "Erro interno. Rode supabase/onboarding-rpc.sql no Supabase." },
      { status: 500 }
    );
  }
}
