import { NextResponse } from "next/server";
import { createClient, getProfile, getSession } from "@/lib/supabase/server";
import { buscarConversaAberta, inserirMensagem, listarMensagens } from "@/lib/suporte/db";

export async function POST() {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const conversa = await buscarConversaAberta(supabase, profile.empresa_id, user.id);
  if (!conversa) {
    return NextResponse.json({ error: "Nenhuma conversa aberta." }, { status: 404 });
  }

  await supabase
    .from("suporte_conversas")
    .update({
      modo: "resolvido",
      resolved_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversa.id);

  await inserirMensagem(supabase, {
    conversaId: conversa.id,
    empresaId: conversa.empresa_id,
    autor: "sistema",
    autorNome: "OperaRoute",
    corpo: "Atendimento encerrado. Quando precisar, abra um novo suporte.",
    meta: { evento: "resolvido_cliente" },
  });

  const mensagens = await listarMensagens(supabase, conversa.id);
  return NextResponse.json({
    conversa: { ...conversa, modo: "resolvido", resolved_at: new Date().toISOString() },
    mensagens,
  });
}
