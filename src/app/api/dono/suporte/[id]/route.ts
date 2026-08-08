import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { inserirMensagem, listarMensagens } from "@/lib/suporte/db";
import { uploadAnexoSuporte } from "@/lib/suporte/anexos";
import { chatCompletion, iaDisponivel } from "@/lib/ia/openai-client";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";
import type { SuporteConversa } from "@/lib/suporte/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: conversa, error } = await admin
    .from("suporte_conversas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const c = conversa as SuporteConversa;
  const [{ data: empresa }, mensagens] = await Promise.all([
    admin.from("empresas").select("id, nome_operacao").eq("id", c.empresa_id).maybeSingle(),
    listarMensagens(admin, id),
  ]);

  return NextResponse.json({
    conversa: { ...c, empresa_nome: empresa?.nome_operacao ?? null },
    mensagens,
    ia_disponivel: iaDisponivel(),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
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
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const c = conversa as SuporteConversa;

  if (acao === "sugerir_ia") {
    const mensagens = await listarMensagens(admin, id);
    const hist = mensagens
      .slice(-12)
      .map((m) => `${m.autor}: ${m.corpo}`)
      .join("\n");
    const result = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Você é o copiloto do dono do SaaS OperaRoute. Sugira uma resposta curta, empática e profissional em português para o cliente. Só o texto da mensagem, sem aspas.",
        },
        {
          role: "user",
          content: `Conversa de suporte:\n${hist}\n\nSugira a próxima resposta do staff.`,
        },
      ],
      { maxTokens: 400, temperature: 0.4 }
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 503 });
    }
    return NextResponse.json({ sugestao: result.text });
  }

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
      corpo: "Atendimento encerrado pelo painel do dono.",
      meta: { evento: "resolvido_dono" },
    });
  } else {
    if (!texto && !file) {
      return NextResponse.json(
        { error: "Digite a resposta ou anexe um arquivo." },
        { status: 400 }
      );
    }

    let anexo = null;
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
      autorId: null,
      autorNome: `Dono · ${session.email}`,
      corpo: texto || (anexo ? `Enviei o arquivo: ${anexo.nome}` : ""),
      anexoUrl: anexo?.url,
      anexoNome: anexo?.nome,
      anexoMime: anexo?.mime,
      anexoTamanho: anexo?.tamanho,
    });
  }

  const { data: atual } = await admin.from("suporte_conversas").select("*").eq("id", id).single();
  const mensagens = await listarMensagens(admin, id);
  return NextResponse.json({ conversa: atual, mensagens });
}
