import { NextResponse } from "next/server";
import { createClient, getProfile, getSession } from "@/lib/supabase/server";
import {
  buscarConversaAberta,
  escalarParaHumano,
  listarMensagens,
} from "@/lib/suporte/db";

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

  await escalarParaHumano(
    supabase,
    conversa,
    "Atendimento transferido para a equipe OperaRoute. Responderemos por aqui."
  );

  const atual = await buscarConversaAberta(supabase, profile.empresa_id, user.id);
  const mensagens = await listarMensagens(supabase, conversa.id);

  return NextResponse.json({ conversa: atual ?? { ...conversa, modo: "humano" }, mensagens });
}
