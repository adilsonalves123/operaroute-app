import { NextResponse } from "next/server";
import { createClient, getProfile, getSession } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { getEmpresa } from "@/lib/supabase/server";
import { registrarAuditoria, requestMeta } from "@/lib/auditoria/registrar";

function detectarDispositivo(ua: string | null): string {
  if (!ua) return "Desconhecido";
  const u = ua.toLowerCase();
  if (u.includes("mobile") || u.includes("android") || u.includes("iphone")) {
    return "Mobile";
  }
  if (u.includes("ipad") || u.includes("tablet")) return "Tablet";
  return "Desktop";
}

/** Abre / renova sessão de acesso no app. */
export async function POST(request: Request) {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const evento = String(body.evento ?? "ping"); // login | ping | logout
  const { ip, userAgent } = requestMeta(request);
  const dispositivo = detectarDispositivo(userAgent);

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);

  if (evento === "logout") {
    const sessaoId = String(body.sessao_id ?? "");
    if (sessaoId) {
      await supabase
        .from("auditoria_sessoes")
        .update({
          encerrado_em: new Date().toISOString(),
          ultimo_ping_em: new Date().toISOString(),
        })
        .eq("id", sessaoId)
        .eq("user_id", user.id);
    }
    await registrarAuditoria({
      supabase,
      empresaId: profile.empresa_id,
      userId: user.id,
      userNome: profile.nome,
      userEmail: user.email ?? profile.email,
      userRole: acesso.role,
      acao: "logout",
      tabela: "auditoria_sessoes",
      severidade: "info",
      categoria: "sessao",
      modulo: "sistema",
      titulo: "Saiu do app",
      resumo: `${profile.nome} encerrou a sessão.`,
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: true });
  }

  // Reusa sessão aberta nas últimas 8h
  const desde = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const { data: aberta } = await supabase
    .from("auditoria_sessoes")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .eq("user_id", user.id)
    .is("encerrado_em", null)
    .gte("iniciado_em", desde)
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aberta && evento === "ping") {
    await supabase
      .from("auditoria_sessoes")
      .update({ ultimo_ping_em: new Date().toISOString() })
      .eq("id", aberta.id);
    return NextResponse.json({ sessao_id: aberta.id, renovada: true });
  }

  if (aberta && evento === "login") {
    await supabase
      .from("auditoria_sessoes")
      .update({ ultimo_ping_em: new Date().toISOString() })
      .eq("id", aberta.id);
    return NextResponse.json({ sessao_id: aberta.id, renovada: true });
  }

  const { data: criada, error } = await supabase
    .from("auditoria_sessoes")
    .insert({
      empresa_id: profile.empresa_id,
      user_id: user.id,
      user_nome: profile.nome,
      user_email: user.email ?? profile.email,
      user_role: acesso.role,
      ip,
      user_agent: userAgent,
      dispositivo,
      meta: { evento },
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("auditoria_sessoes")
          ? "Rode supabase/auditoria-elaborada.sql no Supabase."
          : error.message,
      },
      { status: 500 }
    );
  }

  await registrarAuditoria({
    supabase,
    empresaId: profile.empresa_id,
    userId: user.id,
    userNome: profile.nome,
    userEmail: user.email ?? profile.email,
    userRole: acesso.role,
    acao: evento === "login" ? "login" : "sessao_aberta",
    tabela: "auditoria_sessoes",
    registroId: criada.id,
    severidade: "info",
    categoria: "sessao",
    modulo: "sistema",
    titulo: evento === "login" ? "Entrou no app" : "Sessão ativa no app",
    resumo: `${profile.nome} (${acesso.role}) · ${dispositivo}${ip ? ` · ${ip}` : ""}`,
    ip,
    userAgent,
    meta: { dispositivo, sessao_id: criada.id },
  });

  return NextResponse.json({ sessao_id: criada.id, criada: true });
}

export async function GET(request: Request) {
  const auth = await (await import("@/lib/equipe/require-acesso")).requireAcesso(
    "auditoria",
    "ver"
  );
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40) || 40, 100);

  const { data, error } = await auth.supabase
    .from("auditoria_sessoes")
    .select("*")
    .eq("empresa_id", auth.profile.empresa_id!)
    .order("iniciado_em", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sessoes: data ?? [] });
}
