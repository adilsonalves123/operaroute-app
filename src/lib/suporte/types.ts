export type SuporteModo = "ia" | "humano" | "resolvido";
export type SuporteAutor = "cliente" | "ia" | "staff" | "sistema";

export type SuporteConversa = {
  id: string;
  empresa_id: string;
  user_id: string;
  user_nome: string | null;
  user_email: string | null;
  empresa_nome: string | null;
  assunto: string | null;
  modo: SuporteModo;
  prioridade: string;
  last_message_at: string;
  created_at: string;
  resolved_at: string | null;
};

export type SuporteMensagem = {
  id: string;
  conversa_id: string;
  empresa_id: string;
  autor: SuporteAutor;
  autor_id: string | null;
  autor_nome: string | null;
  corpo: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  anexo_url?: string | null;
  anexo_nome?: string | null;
  anexo_mime?: string | null;
  anexo_tamanho?: number | null;
};

export const ESCALAR_TOKEN = "[[ESCALAR]]";

export function clientePediuHumano(texto: string): boolean {
  const t = texto.toLowerCase();
  return (
    /\b(falar com (um )?(humano|atendente|pessoa|voc[eê]|algu[eé]m))\b/.test(t) ||
    /\b(quero (um )?atendente)\b/.test(t) ||
    /\b(suporte humano)\b/.test(t) ||
    /\b(passar (para|pro) (humano|atendente))\b/.test(t) ||
    /\b(n[aã]o (est[aá]|foi) (ajudando|resolvendo))\b/.test(t)
  );
}
