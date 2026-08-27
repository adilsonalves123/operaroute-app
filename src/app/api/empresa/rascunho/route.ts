import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient } from "@/lib/supabase/server";

/** Liga/desliga o menu Rascunho (só quem edita configurações). */
export async function PATCH(request: Request) {
  const auth = await requireAcesso("configuracoes", "editar");
  if (!auth.ok) return auth.response;

  const { profile } = auth;

  let body: { rascunho_dashboard_ativo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  if (typeof body.rascunho_dashboard_ativo !== "boolean") {
    return NextResponse.json(
      { error: "Informe rascunho_dashboard_ativo (true/false)." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ rascunho_dashboard_ativo: body.rascunho_dashboard_ativo })
    .eq("id", profile.empresa_id!);

  if (error) {
    if (
      error.message.includes("rascunho_dashboard_ativo") ||
      error.message.includes("column") ||
      error.code === "PGRST204"
    ) {
      return NextResponse.json(
        {
          error:
            "Rode no Supabase o SQL supabase/rascunho-dashboard.sql para ativar esta opção.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rascunho_dashboard_ativo: body.rascunho_dashboard_ativo,
  });
}
