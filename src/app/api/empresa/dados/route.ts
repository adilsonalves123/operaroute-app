import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const auth = await requireAcesso("configuracoes", "editar");
  if (!auth.ok) return auth.response;

  const { profile } = auth;

  let body: {
    nome_operacao?: string;
    nome_responsavel?: string;
    chave_pix?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const nomeOperacao = body.nome_operacao?.trim();
  const nomeResponsavel = body.nome_responsavel?.trim();
  const chavePixInformada = body.chave_pix !== undefined;
  const chavePix = chavePixInformada
    ? String(body.chave_pix ?? "").trim() || null
    : undefined;

  if (!nomeOperacao) {
    return NextResponse.json({ error: "Informe o nome da operação." }, { status: 400 });
  }
  if (!nomeResponsavel) {
    return NextResponse.json({ error: "Informe o nome do responsável." }, { status: 400 });
  }
  if (nomeOperacao.length > 120) {
    return NextResponse.json({ error: "Nome da operação muito longo." }, { status: 400 });
  }
  if (nomeResponsavel.length > 120) {
    return NextResponse.json({ error: "Nome do responsável muito longo." }, { status: 400 });
  }
  if (chavePix != null && chavePix.length > 120) {
    return NextResponse.json({ error: "Chave Pix muito longa." }, { status: 400 });
  }

  const supabase = await createClient();
  const empresaId = profile.empresa_id!;

  const empresaUpdate: { nome_operacao: string; chave_pix?: string | null } = {
    nome_operacao: nomeOperacao,
  };
  if (chavePixInformada) {
    empresaUpdate.chave_pix = chavePix;
  }

  const { error: empresaError } = await supabase
    .from("empresas")
    .update(empresaUpdate)
    .eq("id", empresaId);

  if (empresaError) {
    if (
      chavePixInformada &&
      (empresaError.message.includes("chave_pix") ||
        empresaError.message.includes("column") ||
        empresaError.code === "PGRST204")
    ) {
      // Coluna ainda não migrada — salva o restante e avisa.
      const { error: fallbackErr } = await supabase
        .from("empresas")
        .update({ nome_operacao: nomeOperacao })
        .eq("id", empresaId);
      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
      return NextResponse.json(
        {
          error:
            "Rode no Supabase o SQL supabase/empresas-chave-pix.sql para salvar a chave Pix.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: empresaError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      nome: nomeResponsavel,
      nome_operacao: nomeOperacao,
    })
    .eq("user_id", profile.user_id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    nome_operacao: nomeOperacao,
    nome_responsavel: nomeResponsavel,
    chave_pix: chavePixInformada ? chavePix : undefined,
  });
}
