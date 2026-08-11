import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile, getSession } from "@/lib/supabase/server";
import {
  buscarConversaAberta,
  criarConversa,
  escalarParaHumano,
  inserirMensagem,
  listarMensagens,
} from "@/lib/suporte/db";
import { gerarRespostaSuporte } from "@/lib/suporte/ia";
import { clientePediuHumano } from "@/lib/suporte/types";
import { uploadAnexoSuporte, type AnexoSuporte } from "@/lib/suporte/anexos";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";

async function lerPayload(request: Request): Promise<{
  texto: string;
  file: File | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await readRequestFormData(request);
    const texto = String(form.get("texto") ?? "").trim();
    const file = asUploadFile(form.get("arquivo"));
    return { texto, file };
  }
  const body = await request.json().catch(() => ({}));
  return { texto: String(body.texto ?? "").trim(), file: null };
}

export async function POST(request: Request) {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { texto, file } = await lerPayload(request);
  if (!texto && !file) {
    return NextResponse.json({ error: "Digite uma mensagem ou anexe um arquivo." }, { status: 400 });
  }
  if (texto.length > 4000) {
    return NextResponse.json({ error: "Mensagem muito longa." }, { status: 400 });
  }

  const supabase = await createClient();
  let conversa = await buscarConversaAberta(supabase, profile.empresa_id, user.id);

  if (!conversa) {
    const empresa = await getEmpresa(profile.empresa_id);
    const assuntoBase = texto || (file ? `Anexo: ${file.name}` : "Suporte");
    conversa = await criarConversa(supabase, {
      empresaId: profile.empresa_id,
      userId: user.id,
      userNome: profile.nome,
      userEmail: user.email ?? profile.email,
      empresaNome: empresa?.nome_operacao ?? profile.nome_operacao,
      assunto: assuntoBase.slice(0, 80),
    });
    if (!conversa) {
      return NextResponse.json(
        { error: "Falha ao criar conversa. Rode supabase/suporte.sql no Supabase." },
        { status: 500 }
      );
    }
  }

  if (conversa.modo === "resolvido") {
    return NextResponse.json({ error: "Conversa encerrada. Abra um novo atendimento." }, { status: 400 });
  }

  let anexo: AnexoSuporte | null = null;
  if (file) {
    try {
      anexo = await uploadAnexoSuporte(supabase, profile.empresa_id, conversa.id, file);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha no upload." },
        { status: 400 }
      );
    }
  }

  const corpo =
    texto ||
    (anexo ? `Enviei o arquivo: ${anexo.nome}` : "");

  const msgCliente = await inserirMensagem(supabase, {
    conversaId: conversa.id,
    empresaId: profile.empresa_id,
    autor: "cliente",
    autorId: user.id,
    autorNome: profile.nome,
    corpo,
    anexoUrl: anexo?.url,
    anexoNome: anexo?.nome,
    anexoMime: anexo?.mime,
    anexoTamanho: anexo?.tamanho,
  });

  if (!msgCliente) {
    return NextResponse.json(
      {
        error:
          "Não foi possível enviar. Se anexou arquivo, rode também supabase/suporte-anexos.sql.",
      },
      { status: 500 }
    );
  }

  if (!conversa.assunto || conversa.assunto === "Suporte OperaRoute") {
    await supabase
      .from("suporte_conversas")
      .update({ assunto: corpo.slice(0, 80) })
      .eq("id", conversa.id);
  }

  let escalado = false;

  if (conversa.modo === "ia") {
    // Anexo (print/erro) quase sempre precisa de olhar humano
    if (anexo) {
      await inserirMensagem(supabase, {
        conversaId: conversa.id,
        empresaId: profile.empresa_id,
        autor: "ia",
        autorNome: "Assistente OperaRoute",
        corpo:
          "Recebi o arquivo. Vou encaminhar para a equipe ver o anexo e te responder por aqui.",
        meta: { fonte: "local", motivo: "anexo" },
      });
      await escalarParaHumano(
        supabase,
        conversa,
        "Conversa com anexo — a equipe OperaRoute assume daqui."
      );
      escalado = true;
    } else if (clientePediuHumano(texto)) {
      await escalarParaHumano(
        supabase,
        conversa,
        "Você pediu atendimento humano. Em breve a equipe OperaRoute responde aqui."
      );
      escalado = true;
    } else {
      const anteriores = await listarMensagens(supabase, conversa.id);
      const historico = anteriores
        .filter((m) => m.autor === "cliente" || m.autor === "ia")
        .slice(0, -1)
        .map((m) => ({
          role: (m.autor === "cliente" ? "user" : "assistant") as "user" | "assistant",
          content: m.corpo,
        }));

      const ia = await gerarRespostaSuporte(historico, texto);
      await inserirMensagem(supabase, {
        conversaId: conversa.id,
        empresaId: profile.empresa_id,
        autor: "ia",
        autorNome: "Assistente OperaRoute",
        corpo: ia.texto,
        meta: { fonte: ia.fonte },
      });

      if (ia.escalar) {
        await escalarParaHumano(
          supabase,
          conversa,
          "Encaminhei para a equipe humana — eles vêem este histórico e respondem aqui."
        );
        escalado = true;
      }
    }
  }

  const conversaAtual = await buscarConversaAberta(supabase, profile.empresa_id, user.id);
  const mensagens = conversaAtual
    ? await listarMensagens(supabase, conversaAtual.id)
    : await listarMensagens(supabase, conversa.id);

  const { pushSuporteMensagem } = await import("@/lib/push/events");
  pushSuporteMensagem({
    empresaId: profile.empresa_id,
    autorUserId: profile.user_id,
    autorNome: profile.nome,
    preview: texto || (file ? "Anexo enviado" : "Nova mensagem"),
    conversaId: (conversaAtual ?? conversa).id,
  });

  return NextResponse.json({
    conversa: conversaAtual ?? { ...conversa, modo: escalado ? "humano" : conversa.modo },
    mensagens,
    escalado,
  });
}
