import { NextResponse } from "next/server";
import { isRoleCadastro } from "@/lib/equipe/roles";
import { normalizarOverrides } from "@/lib/equipe/permissions";
import { canManageEquipe } from "@/lib/equipe/permissoes";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);

  if (!(await canManageEquipe(supabase, profile, empresa?.owner_id))) {
    return NextResponse.json(
      { error: "Sem permissão para gerenciar a equipe." },
      { status: 403 }
    );
  }

  const { data: existente, error: fetchError } = await supabase
    .from("equipe")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (fetchError || !existente) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.nome != null) {
    const nome = String(body.nome).trim();
    if (!nome) {
      return NextResponse.json({ error: "Informe o nome do membro." }, { status: 400 });
    }
    updates.nome = nome;
  }

  if (body.whatsapp !== undefined) {
    updates.whatsapp = body.whatsapp ? String(body.whatsapp).trim() : null;
  }

  if (body.email !== undefined) {
    const emailRaw = body.email ? String(body.email).trim() : "";
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (emailRaw) {
      const { data: duplicado } = await supabase
        .from("equipe")
        .select("id")
        .eq("empresa_id", profile.empresa_id)
        .ilike("email", emailRaw)
        .neq("id", id)
        .maybeSingle();

      if (duplicado) {
        return NextResponse.json(
          { error: "Já existe um membro com este e-mail na equipe." },
          { status: 409 }
        );
      }
    }
    updates.email = emailRaw || null;
  }

  if (body.role != null) {
    if (existente.role === "admin") {
      return NextResponse.json(
        { error: "Não é possível alterar a função do administrador." },
        { status: 403 }
      );
    }
    const role = String(body.role) as UserRole;
    if (!isRoleCadastro(role)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    updates.role = role;
  }

  if (body.comissao_percentual != null) {
    updates.comissao_percentual = Math.min(
      100,
      Math.max(0, Number(body.comissao_percentual) || 0)
    );
  }

  if (body.status != null) {
    if (existente.role === "admin" && body.status === "inativo") {
      return NextResponse.json(
        { error: "O administrador da operação não pode ser desativado." },
        { status: 403 }
      );
    }
    updates.status = body.status === "inativo" ? "inativo" : "ativo";
  }

  if (body.permissoes !== undefined && existente.role !== "admin") {
    updates.permissoes = normalizarOverrides(body.permissoes);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { data, error } = await supabase
    .from("equipe")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { registrarAuditoria } = await import("@/lib/auditoria/registrar");
  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: profile.user_id,
    userNome: profile.nome,
    userEmail: profile.email,
    acao: "equipe.editar",
    tabela: "equipe",
    registroId: id,
    dadosAnteriores: {
      nome: existente.nome,
      role: existente.role,
      email: existente.email,
      permissoes: existente.permissoes,
    },
    dadosNovos: updates,
    severidade: "role" in updates || "permissoes" in updates ? "critical" : "high",
    categoria: "equipe",
    modulo: "equipe",
    titulo: `Alterou membro ${existente.nome}`,
    resumo: Object.keys(updates).join(", "),
  });

  return NextResponse.json({ success: true, membro: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);

  if (!(await canManageEquipe(supabase, profile, empresa?.owner_id))) {
    return NextResponse.json(
      { error: "Sem permissão para gerenciar a equipe." },
      { status: 403 }
    );
  }

  const { data: existente } = await supabase
    .from("equipe")
    .select("role, user_id, nome")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  if (existente.role === "admin") {
    return NextResponse.json(
      { error: "O administrador da operação não pode ser removido." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("equipe")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "equipe.excluir",
    tabela: "equipe",
    registroId: id,
    dadosAnteriores: { nome: existente.nome, role: existente.role },
    severidade: "critical",
    categoria: "equipe",
    modulo: "equipe",
    titulo: `Removeu ${existente.nome} da equipe`,
    resumo: `Função era ${existente.role}`,
  });

  return NextResponse.json({ success: true });
}
