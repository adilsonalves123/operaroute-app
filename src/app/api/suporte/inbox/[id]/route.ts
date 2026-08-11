import { NextResponse } from "next/server";
import { getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSuporteStaff } from "@/lib/suporte/staff";
import { inserirMensagem, listarMensagens } from "@/lib/suporte/db";
import { uploadAnexoSuporte } from "@/lib/suporte/anexos";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";
import type { SuporteConversa } from "@/lib/suporte/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isSuporteStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissÃ£o de staff." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin nÃ£o configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: conversa, error } = await admin
    .from("suporte_conversas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !conversa) {
    return NextResponse.json({ error: "Conversa nÃ£o encontrada." }, { status: 404 });
  }

  const mensagens = await listarMensagens(admin, id);
  return NextResponse.json({ conversa: conversa as SuporteConversa, mensagens });
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await getSession();
  const profile = await getProfile();
  if (!user || !isSuporteStaff(user, profile)) {
    return NextResponse.json({ error: "Sem permissÃ£o de staff." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin nÃ£o configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";

  let texto = "";
  let acao = "responder";
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await readRequestFormData(request);
    texto = String(form.get("texto") ?? "").trim();
    acao = String(form.get("acao") ?? "responder");
    file = asUploadFile(form.get("arquivo"));
  } else {
    const body = await request.json().catch(() => ({}));
    texto = String(body.texto ?? "").trim();
    acao = String(body.acao ?? "responder");
  }

  const admin = createAdminClient();
  const { data: conversa } = await admin
    .from("suporte_conversas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conversa) {
    return NextResponse.json({ error: "Conversa nÃ£o encontrada." }, { status: 404 });
  }

  const c = conversa as SuporteConversa;

  let anexo: Awaited<ReturnType<typeof uploadAnexoSuporte>> | null = null;

  if (acao === "resolver") {
    await admin
      .from("suporte_conversas")
      .update({
        modo: "resolvido",
        resolved_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", id);

    await inserirMensagem(admin, {
      conversaId: id,
      empresaId: c.empresa_id,
      autor: "sistema",
      autorNome: "OperaRoute",
      corpo: "Atendimento encerrado pela equipe.",
      meta: { evento: "resolvido_staff" },
    });
  } else {
    if (!texto && !file) {
      return NextResponse.json({ error: "Digite a resposta ou anexe um arquivo." }, { status: 400 });
    }

    if (file) {
      try {
        anexo = await uploadAnexoSuporte(admin, c.empresa_id, id, file);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Falha no upload." },
          { status: 400 }
        );
      }
    }

    if (c.modo === "ia") {
      await admin.from("suporte_conversas").update({ modo: "humano" }).eq("id", id);
    }

    await inserirMensagem(admin, {
      conversaId: id,
      empresaId: c.empresa_id,
      autor: "staff",
      autorId: user.id,
      autorNome: profile?.nome ?? user.email ?? "Suporte OperaRoute",
      corpo: texto || (anexo ? `Enviei o arquivo: ${anexo.nome}` : ""),
      anexoUrl: anexo?.url,
      anexoNome: anexo?.nome,
      anexoMime: anexo?.mime,
      anexoTamanho: anexo?.tamanho,
    });
  }

  const { data: atual } = await admin.from("suporte_conversas").select("*").eq("id", id).single();
  const mensagens = await listarMensagens(admin, id);

  if (atual?.empresa_id) {
    const { pushSuporteMensagem } = await import("@/lib/push/events");
    pushSuporteMensagem({
      empresaId: String(atual.empresa_id),
      autorNome: "Suporte OperaRoute",
      preview: texto || (anexo ? `Arquivo: ${anexo.nome}` : "Nova resposta do suporte"),
      conversaId: id,
    });
  }

  return NextResponse.json({ conversa: atual, mensagens });
}
