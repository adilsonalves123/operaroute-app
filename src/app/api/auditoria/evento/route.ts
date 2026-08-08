import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile, getSession } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { registrarAuditoria, requestMeta } from "@/lib/auditoria/registrar";
import type { AuditoriaCategoria, AuditoriaSeveridade } from "@/lib/auditoria/types";

const CATEGORIAS = new Set([
  "sessao",
  "equipamento",
  "coleta",
  "financeiro",
  "ponto",
  "equipe",
  "estoque",
  "chamado",
  "sistema",
  "anomalia",
]);

/** Eventos originados no client (ex.: lançamento financeiro manual). */
export async function POST(request: Request) {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const titulo = String(body.titulo ?? "").trim();
  const acao = String(body.acao ?? "").trim();
  if (!titulo || !acao) {
    return NextResponse.json({ error: "titulo e acao são obrigatórios." }, { status: 400 });
  }

  const categoria = String(body.categoria ?? "sistema");
  if (!CATEGORIAS.has(categoria)) {
    return NextResponse.json({ error: "categoria inválida." }, { status: 400 });
  }

  const severidade = (String(body.severidade ?? "medium") as AuditoriaSeveridade) || "medium";
  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const meta = requestMeta(request);

  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: user.id,
    userNome: profile.nome,
    userEmail: user.email ?? profile.email,
    userRole: acesso.role,
    acao,
    tabela: String(body.tabela ?? "geral"),
    registroId: body.registro_id ?? null,
    dadosAnteriores: body.dados_anteriores ?? null,
    dadosNovos: body.dados_novos ?? null,
    severidade,
    categoria: categoria as AuditoriaCategoria,
    modulo: body.modulo ?? null,
    titulo,
    resumo: body.resumo ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
    meta: body.meta ?? null,
  });

  return NextResponse.json({ ok: true });
}
