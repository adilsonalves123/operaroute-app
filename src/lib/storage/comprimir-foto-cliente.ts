/** Teto seguro abaixo do limite ~4,5 MB da função Vercel (corpo JSON). */
export const MAX_COMPROVANTE_JSON_BYTES = 3_200_000;
/** Foto embutida em data URL: se passar disso, some do payload. */
export const MAX_DATA_URL_BYTES = 90_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(blob);
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) throw new Error("Não foi possível comprimir a imagem.");
  return blob;
}

/**
 * Reduz foto de celular para JPEG pequeno o bastante para upload / comprovante.
 */
export async function comprimirImagemParaJpeg(
  source: Blob,
  opts?: { maxSide?: number; maxBytes?: number }
): Promise<Blob> {
  const maxBytes = opts?.maxBytes ?? 180_000;
  if (source.type === "image/jpeg" && source.size <= maxBytes) return source;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return source;
  }

  let maxSide = opts?.maxSide ?? 1280;
  let quality = 0.76;
  let last = source;

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height, 1));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, w, h);
      last = await canvasToJpeg(canvas, quality);
      if (last.size <= maxBytes) {
        bitmap.close();
        return last;
      }
      maxSide = Math.round(maxSide * 0.78);
      quality = Math.max(0.42, quality - 0.12);
    }
  } finally {
    try {
      bitmap.close();
    } catch {
      /* ignore */
    }
  }

  return last;
}

export async function blobParaDataUrlCompacto(source: Blob): Promise<string> {
  const compact = await comprimirImagemParaJpeg(source, { maxBytes: MAX_DATA_URL_BYTES });
  return blobToDataUrl(compact);
}

function utf8Bytes(s: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
  return s.length;
}

function isFotoKey(key: string): boolean {
  return key === "fotoUrl" || key === "foto_url" || key === "fotoUri";
}

function isHugeDataUrl(value: string): boolean {
  return value.startsWith("data:image") && utf8Bytes(value) > MAX_DATA_URL_BYTES;
}

/** Remove fotos embutidas (data URL) que estourariam o POST /api/comprovantes. */
export function stripHugeDataUrls<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (typeof v === "string" && isFotoKey(k) && isHugeDataUrl(v)) {
          out[k] = null;
        } else if (typeof v === "string" && v.startsWith("data:image") && isHugeDataUrl(v)) {
          out[k] = null;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}

/** Se o JSON ainda estiver grande, tira todas as fotos do relatório. */
export function stripAllRelatorioFotos<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (isFotoKey(k) && typeof v === "string") {
          out[k] = v.startsWith("https://") || v.startsWith("http://") ? v : null;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}

export function jsonByteLength(value: unknown): number {
  try {
    return utf8Bytes(JSON.stringify(value));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
