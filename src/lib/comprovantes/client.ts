"use client";

import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import {
  jsonByteLength,
  MAX_COMPROVANTE_JSON_BYTES,
  stripAllRelatorioFotos,
  stripHugeDataUrls,
} from "@/lib/storage/comprimir-foto-cliente";

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
    if (res.status === 413) {
      return {
        error:
          "As fotos desta coleta são grandes demais para gerar o link. Tente de novo — o app agora comprime as imagens.",
      };
    }
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
    if (
      res.status === 413 ||
      /FUNCTION_PAYLOAD_TOO_LARGE|Entity Too Large/i.test(text)
    ) {
      return {
        error:
          "As fotos desta coleta são grandes demais para gerar o link. Tente de novo; o comprovante será enviado sem as fotos embutidas.",
      };
    }
    return {
      error: `Resposta inválida do servidor (HTTP ${res.status}): ${text.slice(0, 120)}`,
    };
  }
}

function enxugarInput(input: CriarComprovanteClientInput): CriarComprovanteClientInput {
  let next = stripHugeDataUrls(input);
  if (jsonByteLength(next) > MAX_COMPROVANTE_JSON_BYTES) {
    next = stripAllRelatorioFotos(next);
  }
  if (jsonByteLength(next) > MAX_COMPROVANTE_JSON_BYTES && next.snapshot?.relatorio) {
    const { relatorio: _omit, ...restSnap } = next.snapshot;
    next = { ...next, snapshot: restSnap };
  }
  return next;
}

export async function criarLinkComprovante(input: CriarComprovanteClientInput): Promise<{
  url: string;
  mensagem: string;
}> {
  const body = enxugarInput(input);
  const res = await fetch("/api/comprovantes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
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
