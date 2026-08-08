import {
  createAdminClient,
  criarUsuarioAuthAdmin,
  getAuthUserIdByEmail,
} from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import type { Empresa } from "@/lib/types/database";

export type ModoLoginEquipe = "senha" | "convite";

export type CriarLoginInput = {
  email: string;
  nome: string;
  whatsapp?: string | null;
  modo: ModoLoginEquipe;
  senha?: string;
  empresa: Pick<Empresa, "id" | "nome_operacao" | "nicho">;
};

export type CriarLoginResult =
  | {
      ok: true;
      userId: string;
      senhaTemporaria?: string;
      conviteEnviado?: boolean;
      debug?: string[];
    }
  | { ok: false; error: string; code?: string; debug?: string[] };

function falha(
  debug: string[],
  error: string,
  code?: string
): Extract<CriarLoginResult, { ok: false }> {
  debug.push(`ERRO: ${error}${code ? ` [${code}]` : ""}`);
  return { ok: false, error, code, debug };
}

/** Extrai mensagem legível de erros Supabase/Auth (evita "{}" vazio). */
export function mensagemErro(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") {
    const t = err.trim();
    return t && t !== "{}" ? t : fallback;
  }
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code : "";
    const status = o.status;
    const name = typeof o.name === "string" ? o.name : "";

    for (const key of ["message", "msg", "error_description"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim() && v.trim() !== "{}") {
        return code ? `${v.trim()} (${code})` : v.trim();
      }
    }

    if (code) return `${fallback} (código: ${code})`;
    if (name && name !== "AuthApiError") return `${fallback} (${name})`;
    if (typeof status === "number") return `${fallback} (HTTP ${status})`;

    const serialized = JSON.stringify(o);
    if (serialized && serialized !== "{}") return serialized;
  }
  return fallback;
}

function erroAuth500(debug: string[]): string {
  debug.push(
    "DICA: rode supabase/fix-auth-trigger.sql no SQL Editor do Supabase (trigger handle_new_user)"
  );
  return (
    "Erro no banco do Supabase ao criar o usuário (HTTP 500). " +
    "Abra o Supabase → SQL Editor, execute o arquivo supabase/fix-auth-trigger.sql do projeto e tente de novo."
  );
}

function isErroAuthServidor(status?: number, code?: string, name?: string): boolean {
  if (status === 500 || status === 0) return true;
  const c = (code ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  return (
    c === "unexpected_failure" ||
    n.includes("retryablefetch") ||
    n.includes("apierror")
  );
}

function authJaExiste(err: unknown): boolean {
  const o = err as { code?: string; message?: string; status?: number };
  const code = (o.code ?? "").toLowerCase();
  const msg = (o.message ?? "").toLowerCase();
  if (code.includes("exist") || code.includes("registered") || code.includes("duplicate")) {
    return true;
  }
  return (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists") ||
    msg.includes("duplicate")
  );
}

function appOrigin(): string {
  return getAppUrl();
}

async function configurarProfileEquipe(
  userId: string,
  input: CriarLoginInput,
  debug: string[]
): Promise<{ ok: false; error: string } | { ok: true }> {
  const admin = createAdminClient();

  const { data: existente, error: fetchErr } = await admin
    .from("profiles")
    .select("id, empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    debug.push(`perfil.fetch: ${mensagemErro(fetchErr, "erro ao buscar")}`);
    return {
      ok: false,
      error: `Perfil: ${mensagemErro(fetchErr, "erro ao buscar perfil")}`,
    };
  }

  debug.push(
    `perfil.existente=${existente ? `sim (empresa_id=${existente.empresa_id ?? "null"})` : "não"}`
  );

  if (existente?.empresa_id && existente.empresa_id !== input.empresa.id) {
    return {
      ok: false,
      error:
        "Este e-mail já tem conta em outra operação. Use outro e-mail ou peça para remover a conta antiga no Supabase.",
    };
  }

  // Espelha trial/cortesia do dono — o Auth trigger cria trial pessoal de 7 dias.
  const { data: empresaRow } = await admin
    .from("empresas")
    .select("owner_id")
    .eq("id", input.empresa.id)
    .maybeSingle();

  let trialOwner: {
    trial_inicio: string | null;
    trial_fim: string | null;
    assinatura_ativa: boolean | null;
  } | null = null;

  if (empresaRow?.owner_id) {
    const { data: ownerProf } = await admin
      .from("profiles")
      .select("trial_inicio, trial_fim, assinatura_ativa")
      .eq("user_id", empresaRow.owner_id)
      .maybeSingle();
    trialOwner = ownerProf;
  }

  const payload = {
    nome: input.nome,
    email: input.email.toLowerCase(),
    whatsapp: input.whatsapp ?? null,
    empresa_id: input.empresa.id,
    onboarding_completo: true,
    nome_operacao: input.empresa.nome_operacao,
    nicho: input.empresa.nicho,
    assinatura_ativa: trialOwner?.assinatura_ativa ?? true,
    trial_inicio: trialOwner?.trial_inicio ?? null,
    trial_fim: trialOwner?.trial_fim ?? null,
  };

  const { error } = existente
    ? await admin.from("profiles").update(payload).eq("user_id", userId)
    : await admin.from("profiles").insert({ user_id: userId, ...payload });

  if (error) {
    debug.push(`perfil.${existente ? "update" : "insert"}: ${mensagemErro(error, "falhou")}`);
    return {
      ok: false,
      error: `Não foi possível vincular o perfil: ${mensagemErro(error, "erro no banco")}`,
    };
  }

  debug.push(`perfil.${existente ? "update" : "insert"} ok`);
  return { ok: true };
}

async function removerUsuarioAuth(userId: string) {
  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // best effort
  }
}

async function vincularUsuarioExistente(
  userId: string,
  input: CriarLoginInput,
  debug: string[],
  senha?: string
): Promise<CriarLoginResult> {
  const admin = createAdminClient();
  debug.push(`vincular: userId=${userId}`);

  if (senha && senha.length >= 6) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: input.nome,
        whatsapp: input.whatsapp ?? null,
        convite_equipe: input.empresa.id,
      },
    });
    if (error) {
      debug.push(`auth.updateUser: ${mensagemErro(error, "falhou")}`);
      return falha(
        debug,
        `Senha: ${mensagemErro(error, "não foi possível definir a senha")}`
      );
    }
    debug.push("auth.updateUser ok");
  }

  const profileOk = await configurarProfileEquipe(userId, input, debug);
  if (!profileOk.ok) {
    return falha(debug, profileOk.error, "email_em_uso");
  }

  return {
    ok: true,
    userId,
    senhaTemporaria: senha && senha.length >= 6 ? senha : undefined,
    debug,
  };
}

export async function criarLoginMembroEquipe(
  input: CriarLoginInput
): Promise<CriarLoginResult> {
  const debug: string[] = [];
  const email = input.email.trim().toLowerCase();
  debug.push(`email=${email}, modo=${input.modo}`);

  if (!email) {
    return falha(debug, "E-mail é obrigatório para criar login.");
  }

  const admin = createAdminClient();

  const { data: profileByEmail, error: profEmailErr } = await admin
    .from("profiles")
    .select("user_id, empresa_id")
    .ilike("email", email)
    .maybeSingle();

  if (profEmailErr) {
    debug.push(`profiles.byEmail: ${mensagemErro(profEmailErr, "erro")}`);
    return falha(
      debug,
      mensagemErro(profEmailErr, "Erro ao consultar perfil pelo e-mail.")
    );
  }

  debug.push(
    `profiles.byEmail=${profileByEmail ? `user_id=${profileByEmail.user_id}` : "não encontrado"}`
  );

  if (profileByEmail?.user_id) {
    if (profileByEmail.empresa_id && profileByEmail.empresa_id !== input.empresa.id) {
      return falha(
        debug,
        "Este e-mail já está em outra operação. Cadastre com outro e-mail (ex.: biasi.trabalho@gmail.com).",
        "email_em_uso"
      );
    }
    return vincularUsuarioExistente(
      profileByEmail.user_id,
      input,
      debug,
      input.modo === "senha" ? input.senha : undefined
    );
  }

  const authUserId = await getAuthUserIdByEmail(email, debug);
  debug.push(`auth.byEmail=${authUserId ?? "não encontrado"}`);

  if (authUserId) {
    return vincularUsuarioExistente(
      authUserId,
      input,
      debug,
      input.modo === "senha" ? input.senha : undefined
    );
  }

  if (input.modo === "convite") {
    debug.push("auth.inviteUserByEmail...");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome: input.nome,
        whatsapp: input.whatsapp ?? null,
        convite_equipe: input.empresa.id,
      },
      redirectTo: `${appOrigin()}/auth/callback?next=/dashboard`,
    });

    if (error) {
      debug.push(`auth.invite: ${mensagemErro(error, "falhou")}`);
      if (authJaExiste(error)) {
        const uid = await getAuthUserIdByEmail(email, debug);
        debug.push(`auth.retry.byEmail=${uid ?? "não encontrado"}`);
        if (uid) return vincularUsuarioExistente(uid, input, debug);
      }
      if (isErroAuthServidor(error.status, (error as { code?: string }).code, error.name)) {
        return falha(debug, erroAuth500(debug));
      }
      return falha(debug, mensagemErro(error, "Não foi possível enviar o convite."));
    }

    const userId = data.user?.id;
    if (!userId) {
      return falha(debug, "Convite enviado, mas não foi possível obter o usuário.");
    }

    const profileOk = await configurarProfileEquipe(userId, input, debug);
    if (!profileOk.ok) {
      await removerUsuarioAuth(userId);
      return falha(debug, profileOk.error);
    }

    return { ok: true, userId, conviteEnviado: true, debug };
  }

  const senha = input.senha?.trim();
  if (!senha || senha.length < 6) {
    return falha(debug, "A senha deve ter pelo menos 6 caracteres.");
  }

  debug.push("auth.createUser (REST)...");
  const criado = await criarUsuarioAuthAdmin({
    email,
    password: senha,
    metadata: {
      nome: input.nome,
      whatsapp: input.whatsapp ?? null,
      convite_equipe: input.empresa.id,
    },
  });

  if (!criado.ok) {
    debug.push(
      `auth.createUser: HTTP ${criado.status} — ${criado.message}${criado.code ? ` [${criado.code}]` : ""} | raw=${JSON.stringify(criado.raw ?? null).slice(0, 400)}`
    );

    const uid = await getAuthUserIdByEmail(email, debug);
    debug.push(`auth.retry.byEmail=${uid ?? "não encontrado"}`);

    if (uid) {
      return vincularUsuarioExistente(uid, input, debug, senha);
    }

    if (
      authJaExiste({ code: criado.code, message: criado.message }) ||
      criado.status === 422
    ) {
      return falha(
        debug,
        "Este e-mail já existe no Auth, mas não foi encontrado para vincular. Confira no painel Supabase → Authentication.",
        "email_em_uso"
      );
    }

    if (isErroAuthServidor(criado.status, criado.code)) {
      return falha(debug, erroAuth500(debug));
    }

    return falha(
      debug,
      criado.message || "Não foi possível criar o usuário no Supabase Auth."
    );
  }

  const userId = criado.userId;
  debug.push(`auth.createUser ok, userId=${userId}`);

  const profileOk = await configurarProfileEquipe(userId, input, debug);
  if (!profileOk.ok) {
    await removerUsuarioAuth(userId);
    return falha(debug, profileOk.error);
  }

  return { ok: true, userId, senhaTemporaria: senha, debug };
}

export async function redefinirSenhaMembroEquipe(
  userId: string,
  novaSenha: string
): Promise<CriarLoginResult> {
  if (novaSenha.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: novaSenha,
  });

  if (error) {
    return {
      ok: false,
      error: mensagemErro(error, "Não foi possível redefinir a senha."),
    };
  }

  return { ok: true, userId, senhaTemporaria: novaSenha };
}
