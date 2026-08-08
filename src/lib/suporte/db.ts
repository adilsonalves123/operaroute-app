import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuporteConversa, SuporteMensagem, SuporteAutor } from "@/lib/suporte/types";

export async function buscarConversaAberta(
  supabase: SupabaseClient,
  empresaId: string,
  userId: string
): Promise<SuporteConversa | null> {
  const { data } = await supabase
    .from("suporte_conversas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .neq("modo", "resolvido")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as SuporteConversa | null) ?? null;
}

export async function listarMensagens(
  supabase: SupabaseClient,
  conversaId: string
): Promise<SuporteMensagem[]> {
  const { data } = await supabase
    .from("suporte_mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  return (data as SuporteMensagem[]) ?? [];
}

export async function criarConversa(
  supabase: SupabaseClient,
  input: {
    empresaId: string;
    userId: string;
    userNome?: string | null;
    userEmail?: string | null;
    empresaNome?: string | null;
    assunto?: string | null;
  }
): Promise<SuporteConversa | null> {
  const { data, error } = await supabase
    .from("suporte_conversas")
    .insert({
      empresa_id: input.empresaId,
      user_id: input.userId,
      user_nome: input.userNome ?? null,
      user_email: input.userEmail ?? null,
      empresa_nome: input.empresaNome ?? null,
      assunto: input.assunto ?? null,
      modo: "ia",
    })
    .select("*")
    .single();

  if (error) return null;
  return data as SuporteConversa;
}

export async function inserirMensagem(
  supabase: SupabaseClient,
  input: {
    conversaId: string;
    empresaId: string;
    autor: SuporteAutor;
    autorId?: string | null;
    autorNome?: string | null;
    corpo: string;
    meta?: Record<string, unknown> | null;
    anexoUrl?: string | null;
    anexoNome?: string | null;
    anexoMime?: string | null;
    anexoTamanho?: number | null;
  }
): Promise<SuporteMensagem | null> {
  const { data, error } = await supabase
    .from("suporte_mensagens")
    .insert({
      conversa_id: input.conversaId,
      empresa_id: input.empresaId,
      autor: input.autor,
      autor_id: input.autorId ?? null,
      autor_nome: input.autorNome ?? null,
      corpo: input.corpo,
      meta: input.meta ?? null,
      anexo_url: input.anexoUrl ?? null,
      anexo_nome: input.anexoNome ?? null,
      anexo_mime: input.anexoMime ?? null,
      anexo_tamanho: input.anexoTamanho ?? null,
    })
    .select("*")
    .single();

  if (error) return null;

  await supabase
    .from("suporte_conversas")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversaId);

  return data as SuporteMensagem;
}

export async function escalarParaHumano(
  supabase: SupabaseClient,
  conversa: SuporteConversa,
  motivo: string
): Promise<void> {
  if (conversa.modo === "humano") return;

  await supabase
    .from("suporte_conversas")
    .update({
      modo: "humano",
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversa.id);

  await inserirMensagem(supabase, {
    conversaId: conversa.id,
    empresaId: conversa.empresa_id,
    autor: "sistema",
    autorNome: "OperaRoute",
    corpo: motivo,
    meta: { evento: "escalado" },
  });
}
