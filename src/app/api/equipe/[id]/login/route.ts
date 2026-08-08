import { NextResponse } from "next/server";
import {
  criarLoginMembroEquipe,
  redefinirSenhaMembroEquipe,
  type ModoLoginEquipe,
} from "@/lib/equipe/criar-login";
import { canManageEquipe } from "@/lib/equipe/permissoes";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";

type BodyLogin = {
  action?: "criar" | "redefinir_senha";
  email?: string;
  senha?: string;
  modo_login?: ModoLoginEquipe;
};

function asTextoErro(val: unknown, fallback: string): string {
  if (typeof val === "string" && val.trim() && val.trim() !== "{}") return val.trim();
  return fallback;
}

function debugResponse(
  error: unknown,
  status: number,
  debug: string[],
  extra?: Record<string, unknown>
) {
  const msg = asTextoErro(error, "Erro ao criar login.");
  console.error("[login-debug]", { status, error: msg, debug, ...extra });
  return NextResponse.json({ error: msg, debug, ...extra }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const debug: string[] = [];
  try {
    const { id } = await params;
    debug.push(`1. membro_id=${id}`);

    const profile = await getProfile();
    if (!profile?.empresa_id) {
      debug.push("2. FALHA: profile sem empresa_id");
      return debugResponse("Empresa não encontrada", 404, debug);
    }
    debug.push(`2. profile ok (empresa_id=${profile.empresa_id})`);

    if (!isAdminConfigured()) {
      debug.push("3. FALHA: SUPABASE_SERVICE_ROLE_KEY não configurada");
      return debugResponse(
        "Criação de login não configurada. Reinicie o servidor após configurar SUPABASE_SERVICE_ROLE_KEY no .env.local.",
        503,
        debug,
        { config_pendente: true }
      );
    }
    debug.push("3. admin client configurado");

    const supabase = await createClient();
    const empresa = await getEmpresa(profile.empresa_id);

    if (!(await canManageEquipe(supabase, profile, empresa?.owner_id))) {
      debug.push("4. FALHA: sem permissão para gerenciar equipe");
      return debugResponse("Sem permissão para gerenciar logins da equipe.", 403, debug);
    }
    debug.push("4. permissão ok");

    const { data: membro, error: fetchError } = await supabase
      .from("equipe")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

    if (fetchError || !membro) {
      debug.push(`5. FALHA: membro não encontrado (${fetchError?.message ?? "sem registro"})`);
      return debugResponse("Membro não encontrado.", 404, debug);
    }
    debug.push(`5. membro ok (nome=${membro.nome}, user_id=${membro.user_id ?? "null"})`);

    if (membro.role === "admin") {
      debug.push("6. FALHA: tentativa de login em admin");
      return debugResponse(
        "Use Configurações para alterar o login do administrador.",
        403,
        debug
      );
    }

    const body = (await request.json()) as BodyLogin;
    const action = body.action ?? "criar";
    debug.push(`6. action=${action}`);

    if (action === "redefinir_senha") {
      if (!membro.user_id) {
        return NextResponse.json(
          { error: "Este membro ainda não possui login." },
          { status: 400 }
        );
      }
      const senha = String(body.senha ?? "").trim();
      const result = await redefinirSenhaMembroEquipe(membro.user_id, senha);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const { auditarAcao } = await import("@/lib/auditoria/auditar");
      await auditarAcao(supabase, profile, {
        acao: "equipe.redefinir_senha",
        tabela: "equipe",
        registroId: id,
        severidade: "critical",
        categoria: "equipe",
        modulo: "equipe",
        titulo: `Redefiniu senha de ${membro.nome}`,
        resumo: "Login da equipe alterado",
        request,
      });
      return NextResponse.json({
        success: true,
        senhaTemporaria: result.senhaTemporaria,
      });
    }

    const email = (body.email ?? membro.email ?? "").trim().toLowerCase();
    if (!email) {
      debug.push("7. FALHA: e-mail vazio");
      return debugResponse("Informe o e-mail do membro para criar o login.", 400, debug);
    }
    debug.push(`7. email=${email}`);

    if (membro.user_id) {
      debug.push(`8. FALHA: membro já tem user_id=${membro.user_id}`);
      return debugResponse("Este membro já possui login vinculado.", 409, debug);
    }

    if (!empresa) {
      debug.push("8. FALHA: empresa não encontrada");
      return debugResponse("Empresa não encontrada.", 404, debug);
    }

    const modo = (body.modo_login === "convite" ? "convite" : "senha") as ModoLoginEquipe;
    const senha = body.senha ? String(body.senha).trim() : undefined;
    debug.push(`8. modo=${modo}, senha_len=${senha?.length ?? 0}`);

    if (modo === "senha" && (!senha || senha.length < 6)) {
      debug.push("9. FALHA: senha curta");
      return debugResponse("A senha deve ter pelo menos 6 caracteres.", 400, debug);
    }

    debug.push("9. chamando criarLoginMembroEquipe...");
    const loginResult = await criarLoginMembroEquipe({
      email,
      nome: membro.nome,
      whatsapp: membro.whatsapp,
      modo,
      senha,
      empresa: {
        id: empresa.id,
        nome_operacao: empresa.nome_operacao,
        nicho: empresa.nicho,
      },
    });

    if (!loginResult.ok) {
      debug.push(
        `10. FALHA criarLogin: code=${loginResult.code ?? "—"}, msg=${loginResult.error}`
      );
      if (loginResult.debug?.length) {
        debug.push("--- detalhe criarLogin ---", ...loginResult.debug);
      }
      return debugResponse(loginResult.error, 400, debug, { code: loginResult.code });
    }
    if (loginResult.debug?.length) {
      debug.push("--- detalhe criarLogin ---", ...loginResult.debug);
    }
    debug.push(`10. auth ok, userId=${loginResult.userId}`);

    const { data: atualizado, error: updateError } = await supabase
      .from("equipe")
      .update({
        user_id: loginResult.userId,
        email,
      })
      .eq("id", id)
      .eq("empresa_id", profile.empresa_id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      debug.push(`11. FALHA vincular equipe: ${updateError.message}`);
      return debugResponse(
        `Login criado, mas falhou ao vincular na equipe: ${updateError.message}`,
        500,
        debug
      );
    }
    debug.push("11. equipe atualizada com user_id");

    const { auditarAcao } = await import("@/lib/auditoria/auditar");
    await auditarAcao(supabase, profile, {
      acao: "equipe.criar_login",
      tabela: "equipe",
      registroId: id,
      severidade: "critical",
      categoria: "equipe",
      modulo: "equipe",
      titulo: `Criou login para ${membro.nome}`,
      resumo: email,
      request,
    });

    return NextResponse.json({
      success: true,
      membro: atualizado,
      login: {
        criado: true,
        conviteEnviado: Boolean(loginResult.conviteEnviado),
        senhaTemporaria: loginResult.senhaTemporaria,
      },
      debug,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno ao criar login.";
    debug.push(`EXCEÇÃO: ${message}`);
    console.error("POST /api/equipe/[id]/login:", err, { debug });
    return debugResponse(message, 500, debug);
  }
}
