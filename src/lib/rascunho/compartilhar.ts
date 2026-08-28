import { absoluteUrl } from "@/lib/app-url";

export type ResumoRascunhoPontoSnap = {
  nome: string;
  valor: number;
  forma?: string;
};

export type ResumoRascunhoSnapshot = {
  empresaNome: string;
  titulo: string;
  dataISO: string;
  /** Entradas (só valores positivos dos pontos). */
  recebido: number;
  /** Valor deixado em ponto(s) — visita negativa, prêmio, etc. */
  deixado: number;
  totalLiquido: number;
  pix: number;
  dinheiro: number;
  pontos: ResumoRascunhoPontoSnap[];
};

export function gerarTokenResumoRascunho(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function resumoRascunhoPublicUrl(token: string): string {
  return absoluteUrl(`/r/${token}`);
}

export async function criarLinkResumoRascunho(
  snapshot: ResumoRascunhoSnapshot,
  origin?: string
): Promise<string> {
  const res = await fetch("/api/rascunho/compartilhar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      snapshot,
      origin:
        origin ??
        (typeof window !== "undefined" ? window.location.origin : undefined),
    }),
  });
  const data = (await res.json()) as { error?: string; url?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Não foi possível gerar o link.");
  }
  return data.url;
}

/** Compartilha só o link (WhatsApp, Telegram, etc.). */
export async function compartilharSomenteLink(url: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "failed";
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    /* ignore */
  }
  return "failed";
}
