import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { trialFimIso } from "@/lib/assinatura-acesso";

/**
 * Corrige perfil travado com assinatura_ativa=true (bug do RPC antigo)
 * e reinicia 7 dias de trial — só para o dono/admin da operação.
 */
export async function POST() {
  const auth = await requireAcesso("configuracoes", "editar");
  if (!auth.ok) return auth.response;

  const { profile, supabase, empresa, acesso } = auth;

  if (!acesso.isOwner && acesso.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas o responsável da operação pode reparar o trial." },
      { status: 403 }
    );
  }

  const ownerId = empresa?.owner_id ?? profile.user_id;
  const agora = new Date().toISOString();
  const trialFim = trialFimIso();

  const { error } = await supabase
    .from("profiles")
    .update({
      assinatura_ativa: false,
      trial_inicio: agora,
      trial_fim: trialFim,
    })
    .eq("user_id", ownerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se o usuário logado não é o owner, alinha o próprio perfil também (visão de banner)
  if (profile.user_id !== ownerId) {
    await supabase
      .from("profiles")
      .update({
        assinatura_ativa: false,
        trial_inicio: agora,
        trial_fim: trialFim,
      })
      .eq("user_id", profile.user_id);
  }

  return NextResponse.json({
    success: true,
    assinatura_ativa: false,
    trial_fim: trialFim,
  });
}
