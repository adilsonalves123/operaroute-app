import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile, getSession } from "@/lib/supabase/server";
import {
  buscarConversaAberta,
  listarMensagens,
} from "@/lib/suporte/db";

export async function GET() {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const conversa = await buscarConversaAberta(supabase, profile.empresa_id, user.id);
  if (!conversa) {
    return NextResponse.json({ conversa: null, mensagens: [] });
  }

  const mensagens = await listarMensagens(supabase, conversa.id);
  return NextResponse.json({ conversa, mensagens });
}

export async function POST() {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  let conversa = await buscarConversaAberta(supabase, profile.empresa_id, user.id);

  if (!conversa) {
    const empresa = await getEmpresa(profile.empresa_id);
    const { criarConversa, inserirMensagem } = await import("@/lib/suporte/db");
    conversa = await criarConversa(supabase, {
      empresaId: profile.empresa_id,
      userId: user.id,
      userNome: profile.nome,
      userEmail: user.email ?? profile.email,
      empresaNome: empresa?.nome_operacao ?? profile.nome_operacao,
      assunto: "Suporte OperaRoute",
    });
    if (!conversa) {
      return NextResponse.json(
        { error: "Não foi possível abrir o suporte. Confirme se rodou supabase/suporte.sql." },
        { status: 500 }
      );
    }
    await inserirMensagem(supabase, {
      conversaId: conversa.id,
      empresaId: profile.empresa_id,
      autor: "sistema",
      autorNome: "OperaRoute",
      corpo:
        "Olá — sou a assistente de suporte. Posso ajudar com o uso do app. Se eu não resolver, passo para a equipe humana.",
      meta: { evento: "abertura" },
    });
  }

  const mensagens = await listarMensagens(supabase, conversa.id);
  return NextResponse.json({ conversa, mensagens });
}
