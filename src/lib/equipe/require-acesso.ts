import { NextResponse } from "next/server";
import { getAcessoUsuario, usuarioPode } from "@/lib/equipe/acesso";
import type { PermissaoAcao, PermissaoModulo } from "@/lib/equipe/permissions";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";

export async function requireAcesso(modulo: PermissaoModulo, acao: PermissaoAcao) {
  const { profile, supabase, empresa } = await getAppBootstrap();
  if (!profile?.empresa_id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 }),
    };
  }

  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);

  if (!usuarioPode(acesso, modulo, acao)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Sem permissão para esta ação." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, profile, supabase, empresa, acesso };
}
