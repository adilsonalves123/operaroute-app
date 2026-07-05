import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

const CONFIRMACAO = "ZERAR";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  let body: { confirmacao?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  if (body.confirmacao?.trim().toUpperCase() !== CONFIRMACAO) {
    return NextResponse.json(
      { error: `Digite ${CONFIRMACAO} para confirmar.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("zerar_dados_operacionais");

  if (error) {
    if (error.message.includes("not_authenticated")) {
      return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
    }
    if (error.message.includes("not_authorized")) {
      return NextResponse.json(
        { error: "Apenas o responsável ou administrador pode zerar os dados." },
        { status: 403 }
      );
    }
    if (error.message.includes("Could not find the function")) {
      return NextResponse.json(
        {
          error:
            "Função não instalada no banco. Rode supabase/zerar-dados-operacionais.sql no Supabase.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, removidos: data });
}
