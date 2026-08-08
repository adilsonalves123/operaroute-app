import { NextResponse } from "next/server";
import {
  canAddMembroEquipe,
  contarMembrosEquipeAtivos,
  getLimiteUsuariosEquipe,
} from "@/lib/equipe/limits";
import { criarLoginMembroEquipe, type ModoLoginEquipe } from "@/lib/equipe/criar-login";
import { normalizarOverrides } from "@/lib/equipe/permissions";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { canManageEquipe } from "@/lib/equipe/permissoes";
import { isRoleCadastro } from "@/lib/equipe/roles";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export async function GET() {
  const auth = await requireAcesso("equipe", "ver");
  if (!auth.ok) return auth.response;

  const { profile, supabase } = auth;
  const { data, error } = await supabase
    .from("equipe")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("nome");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    membros: data ?? [],
    loginDisponivel: isAdminConfigured(),
  });
}

export async function POST(request: Request) {
  try {
  const auth = await requireAcesso("equipe", "criar");
  if (!auth.ok) return auth.response;

  const { profile, supabase, empresa } = auth;
  if (!profile.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (!(await canManageEquipe(supabase, profile, empresa?.owner_id))) {
    return NextResponse.json(
      { error: "Sem permissão para gerenciar a equipe." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const nome = String(body.nome ?? "").trim();
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do membro." }, { status: 400 });
  }

  const role = String(body.role ?? "operador") as UserRole;
  if (!isRoleCadastro(role)) {
    return NextResponse.json(
      { error: "Função inválida. Use gerente, operador ou visualizador." },
      { status: 400 }
    );
  }

  const criarLogin = Boolean(body.criar_login);
  const emailRaw = body.email ? String(body.email).trim().toLowerCase() : "";

  if (criarLogin && !emailRaw) {
    return NextResponse.json(
      { error: "Informe o e-mail para criar o login." },
      { status: 400 }
    );
  }

  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  if (criarLogin && !isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Criação de login não configurada. Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local.",
        config_pendente: true,
      },
      { status: 503 }
    );
  }

  const { data: membrosAtivosLista } = await supabase
    .from("equipe")
    .select("role, status")
    .eq("empresa_id", profile.empresa_id)
    .eq("status", "ativo");

  const membrosNoLimite = contarMembrosEquipeAtivos(membrosAtivosLista ?? []);

  if (empresa && !canAddMembroEquipe(membrosNoLimite, empresa.limite_usuarios)) {
    return NextResponse.json(
      {
        error: `Limite de colaboradores atingido (${getLimiteUsuariosEquipe(empresa.limite_usuarios)} vagas). Faça upgrade em /planos.`,
        limite_atingido: true,
      },
      { status: 403 }
    );
  }

  if (emailRaw) {
    const { data: duplicado } = await supabase
      .from("equipe")
      .select("id, user_id, nome")
      .eq("empresa_id", profile.empresa_id)
      .ilike("email", emailRaw)
      .maybeSingle();

    if (duplicado) {
      if (criarLogin && !duplicado.user_id && empresa) {
        const modo = (body.modo_login === "convite" ? "convite" : "senha") as ModoLoginEquipe;
        const loginResult = await criarLoginMembroEquipe({
          email: emailRaw,
          nome: duplicado.nome ?? nome,
          whatsapp: body.whatsapp ? String(body.whatsapp).trim() : null,
          modo,
          senha: body.senha ? String(body.senha) : undefined,
          empresa: {
            id: empresa.id,
            nome_operacao: empresa.nome_operacao,
            nicho: empresa.nicho,
          },
        });

        if (!loginResult.ok) {
          return NextResponse.json(
            { error: loginResult.error, code: loginResult.code },
            { status: 400 }
          );
        }

        const { data: atualizado, error: updErr } = await supabase
          .from("equipe")
          .update({ user_id: loginResult.userId })
          .eq("id", duplicado.id)
          .eq("empresa_id", profile.empresa_id)
          .select("*")
          .maybeSingle();

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          membro: atualizado,
          login: {
            criado: true,
            conviteEnviado: Boolean(loginResult.conviteEnviado),
            senhaTemporaria: loginResult.senhaTemporaria,
          },
          vinculado: true,
        });
      }

      return NextResponse.json(
        {
          error:
            "Já existe um membro com este e-mail. Edite o membro existente ou use «Criar login» no card dele.",
        },
        { status: 409 }
      );
    }
  }

  const comissao = Math.min(100, Math.max(0, Number(body.comissao_percentual) || 0));
  const status = body.status === "inativo" ? "inativo" : "ativo";

  let userId: string | null = null;
  let senhaTemporaria: string | undefined;
  let conviteEnviado = false;

  if (criarLogin && emailRaw && empresa) {
    const modo = (body.modo_login === "convite" ? "convite" : "senha") as ModoLoginEquipe;
    const loginResult = await criarLoginMembroEquipe({
      email: emailRaw,
      nome,
      whatsapp: body.whatsapp ? String(body.whatsapp).trim() : null,
      modo,
      senha: body.senha ? String(body.senha) : undefined,
      empresa: {
        id: empresa.id,
        nome_operacao: empresa.nome_operacao,
        nicho: empresa.nicho,
      },
    });

    if (!loginResult.ok) {
      return NextResponse.json({ error: loginResult.error, code: loginResult.code }, { status: 400 });
    }

    userId = loginResult.userId;
    senhaTemporaria = loginResult.senhaTemporaria;
    conviteEnviado = Boolean(loginResult.conviteEnviado);
  }

  const { data, error } = await supabase
    .from("equipe")
    .insert({
      empresa_id: profile.empresa_id,
      user_id: userId,
      nome,
      whatsapp: body.whatsapp ? String(body.whatsapp).trim() : null,
      email: emailRaw || null,
      role,
      comissao_percentual: comissao,
      status,
      permissoes: normalizarOverrides(body.permissoes),
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "equipe.criar",
    tabela: "equipe",
    registroId: data?.id ?? null,
    dadosNovos: { nome, email: emailRaw || null, role, status },
    severidade: "high",
    categoria: "equipe",
    modulo: "equipe",
    titulo: `Adicionou ${nome} à equipe`,
    resumo: `Função ${role}${criarLogin ? " · login criado" : ""}`,
    request,
  });

  return NextResponse.json({
    success: true,
    membro: data,
    login: criarLogin
      ? {
          criado: Boolean(userId),
          conviteEnviado,
          senhaTemporaria,
        }
      : undefined,
  });
  } catch (err) {
    console.error("POST /api/equipe:", err);
    const message = err instanceof Error ? err.message : "Erro interno ao salvar membro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
