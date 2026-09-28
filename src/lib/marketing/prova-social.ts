export const PROVA_SOCIAL_CONFIG_KEY = "landing_prova_social";

export const MAX_DEPOIMENTOS = 12;
export const MAX_TEXTO_DEPOIMENTO = 400;

export type Depoimento = {
  id: string;
  nome: string;
  /** Nome da operação/empresa. */
  operacao: string;
  cidade: string;
  texto: string;
  foto_url: string | null;
  ativo: boolean;
};

export type ProvaSocial = {
  video_url: string | null;
  video_titulo: string;
  depoimentos: Depoimento[];
};

export type VideoResolvido =
  | { tipo: "embed"; src: string }
  | { tipo: "arquivo"; src: string };

export const PROVA_SOCIAL_VAZIA: ProvaSocial = {
  video_url: null,
  video_titulo: "",
  depoimentos: [],
};

function texto(valor: unknown, max: number): string {
  return String(valor ?? "").trim().slice(0, max);
}

function urlHttps(valor: unknown): string | null {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  try {
    const url = new URL(bruto);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** YouTube (watch, youtu.be, shorts, embed), Vimeo ou arquivo .mp4/.webm direto. */
export function resolverVideo(url: string | null | undefined): VideoResolvido | null {
  const seguro = urlHttps(url);
  if (!seguro) return null;
  const u = new URL(seguro);
  const host = u.hostname.replace(/^www\.|^m\./, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtubeId =
      u.searchParams.get("v") ??
      u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { tipo: "embed", src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,12})/)?.[1];
    if (id) return { tipo: "embed", src: `https://player.vimeo.com/video/${id}` };
  }

  if (/\.(mp4|webm)$/i.test(u.pathname)) return { tipo: "arquivo", src: seguro };
  return null;
}

export function normalizarProvaSocial(valor: unknown): ProvaSocial {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return { ...PROVA_SOCIAL_VAZIA, depoimentos: [] };
  }
  const bruto = valor as Record<string, unknown>;
  const lista = Array.isArray(bruto.depoimentos) ? bruto.depoimentos : [];

  const depoimentos: Depoimento[] = lista
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
    .map((d, i) => ({
      id: texto(d.id, 40) || `dep-${i + 1}`,
      nome: texto(d.nome, 60),
      operacao: texto(d.operacao, 80),
      cidade: texto(d.cidade, 60),
      texto: texto(d.texto, MAX_TEXTO_DEPOIMENTO),
      foto_url: urlHttps(d.foto_url),
      ativo: d.ativo !== false,
    }))
    .filter((d) => d.nome || d.texto)
    .slice(0, MAX_DEPOIMENTOS);

  const videoUrl = urlHttps(bruto.video_url);
  return {
    video_url: resolverVideo(videoUrl) ? videoUrl : null,
    video_titulo: texto(bruto.video_titulo, 120),
    depoimentos,
  };
}

/** O que a landing mostra: só depoimentos ativos e completos. */
export function depoimentosPublicos(prova: ProvaSocial): Depoimento[] {
  return prova.depoimentos.filter((d) => d.ativo && d.nome && d.texto);
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1]![0] ?? "" : "";
  return (primeira + ultima).toUpperCase();
}
