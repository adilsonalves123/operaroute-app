"use client";

import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

export type CriarComprovanteClientInput = {
  visita_ponto_id?: string;
  visita_id?: string;
  previa?: boolean;
  divida_saldo?: number;
  desconto?: number;
  pix?: number;
  dinheiro?: number;
  haver_saldo?: number;
  descontar_haver?: boolean;
  nome_operacao?: string | null;
  chave_pix?: string | null;
  snapshot?: ComprovanteSnapshot;
};

async function parseJsonSafe(res: Response): Promise<{
  error?: string;
  url?: string;
  mensagem?: string;
  success?: boolean;
}> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      error: `Servidor respondeu vazio (HTTP ${res.status}). Tente de novo; se persistir, confira SUPABASE_SERVICE_ROLE_KEY e a tabela public_comprovantes.`,
    };
  }
  try {
    return JSON.parse(text) as {
      error?: string;
      url?: string;
      mensagem?: string;
      success?: boolean;
    };
  } catch {
    return {
      error: `Resposta inválida do servidor (HTTP ${res.status}): ${text.slice(0, 120)}`,
    };
  }
}

export async function criarLinkComprovante(input: CriarComprovanteClientInput): Promise<{
  url: string;
  mensagem: string;
}> {
  const res = await fetch("/api/comprovantes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok || !data.url || !data.mensagem) {
    throw new Error(
      data.error ?? "Não foi possível gerar o link do comprovante."
    );
  }
  return { url: data.url, mensagem: data.mensagem };
}

export async function abrirWhatsAppComComprovante(opts: {
  telefone: string | null | undefined;
  input: CriarComprovanteClientInput;
}): Promise<void> {
  const { mensagem } = await criarLinkComprovante(opts.input);
  const link = whatsAppUrl(opts.telefone, mensagem);
  window.open(link, "_blank", "noopener,noreferrer");
}
