import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  cancelarAssinaturaEmpresa,
  type ModoCancelamento,
} from "@/lib/billing/cancelar-assinatura";
import { registrarAuditoria, requestMeta } from "@/lib/auditoria/registrar";

export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  const { profile, acesso, empresa } = auth;

  if (!acesso.isOwner && acesso.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas o responsável ou administrador pode cancelar a assinatura." },
      { status: 403 }
    );
  }

  let body: { modo?: ModoCancelamento };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const modo: ModoCancelamento =
    body.modo === "imediato" ? "imediato" : "fim_periodo";

  const supabase = await createClient();
  const empresaId = profile.empresa_id!;

  let assinaturaVenceEm: string | null = null;
  const { data: empresaRow } = await supabase
    .from("empresas")
    .select("assinatura_vence_em, owner_id")
    .eq("id", empresaId)
    .maybeSingle();

  assinaturaVenceEm = empresaRow?.assinatura_vence_em ?? null;

  const client =
    isAdminConfigured() ? createAdminClient() : supabase;

  const result = await cancelarAssinaturaEmpresa(client, {
    empresaId,
    modo,
    assinaturaVenceEm,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const meta = requestMeta(request);
  await registrarAuditoria({
    supabase,
    empresaId,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: profile.email,
    acao: "assinatura.cancelar",
    tabela: "empresas",
    registroId: empresaId,
    dadosNovos: { modo, acesso_ate: result.acesso_ate },
    severidade: "high",
    categoria: "sistema",
    modulo: "planos",
    titulo: "Assinatura cancelada pelo cliente",
    resumo:
      modo === "imediato"
        ? "Encerramento imediato solicitado."
        : "Renovação cancelada; acesso até o fim do período pago.",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    success: true,
    modo,
    acesso_ate: result.acesso_ate,
  });
}
