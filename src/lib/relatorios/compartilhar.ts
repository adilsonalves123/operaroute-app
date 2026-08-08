/**
 * Compartilha mídia / link de relatório de coleta.
 * Prioridade: Web Share (arquivo) → Web Share (URL/texto) → copiar link → baixar.
 */

export type CompartilharResultado =
  | "shared"
  | "copied"
  | "downloaded"
  | "cancelled"
  | "failed";

async function tryShare(data: ShareData): Promise<CompartilharResultado | null> {
  if (typeof navigator === "undefined" || !navigator.share) return null;
  try {
    if (data.files?.length && navigator.canShare && !navigator.canShare({ files: data.files })) {
      return null;
    }
    await navigator.share(data);
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    if (e instanceof Error && e.name === "AbortError") return "cancelled";
    return null;
  }
}

async function tryCopyText(text: string): Promise<CompartilharResultado | null> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* ignore */
  }
  return null;
}

function downloadBlobLocal(blob: Blob, fileName: string): CompartilharResultado {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return "downloaded";
}

/** Compartilha PNG gerado na prévia / modal (blob em memória). */
export async function compartilharBlobRelatorio(opts: {
  blob: Blob;
  titulo: string;
  texto?: string;
  fileName?: string;
}): Promise<CompartilharResultado> {
  const { blob, titulo, texto, fileName = "relatorio.png" } = opts;
  const shareText = texto?.trim() || titulo;
  const type = blob.type || "image/png";
  const file = new File([blob], fileName, { type });

  const withFile = await tryShare({
    title: titulo,
    text: shareText,
    files: [file],
  });
  if (withFile) return withFile;

  const withText = await tryShare({
    title: titulo,
    text: shareText,
  });
  if (withText) return withText;

  return downloadBlobLocal(blob, fileName);
}

/** Compartilha link público do comprovante. */
export async function compartilharLinkRelatorio(opts: {
  url: string;
  titulo: string;
  texto?: string;
}): Promise<CompartilharResultado> {
  const { url, titulo, texto } = opts;
  const shareText = texto?.trim() || titulo;

  const shared = await tryShare({
    title: titulo,
    text: shareText,
    url,
  });
  if (shared) return shared;

  const copied = await tryCopyText(url);
  if (copied) return copied;

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return "downloaded";
  } catch {
    return "failed";
  }
}

export async function compartilharMidiaRelatorio(opts: {
  url: string;
  titulo: string;
  texto?: string;
  fileName?: string;
}): Promise<CompartilharResultado> {
  const { url, titulo, texto, fileName = "relatorio.png" } = opts;
  const shareText = texto?.trim() || titulo;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const type = blob.type || "image/png";
    const file = new File([blob], fileName, { type });

    const withFile = await tryShare({
      title: titulo,
      text: shareText,
      files: [file],
    });
    if (withFile) return withFile;

    const withUrl = await tryShare({
      title: titulo,
      text: shareText,
      url,
    });
    if (withUrl) return withUrl;

    const copied = await tryCopyText(url);
    if (copied) return copied;

    return downloadBlobLocal(blob, fileName);
  } catch {
    return compartilharLinkRelatorio({ url, titulo, texto });
  }
}

/** Mensagem curta de feedback para o operador. */
export function mensagemCompartilhar(resultado: CompartilharResultado): string | null {
  switch (resultado) {
    case "copied":
      return "Link copiado.";
    case "downloaded":
      return "Arquivo baixado — envie pelo app desejado.";
    case "failed":
      return "Não foi possível compartilhar.";
    default:
      return null;
  }
}
