import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function cropBitmapRegion(
  bitmap: ImageBitmap,
  rect: PixelRect,
  outputName: string,
  paddingRatio = 0.08
): Promise<File> {
  const padX = rect.width * paddingRatio;
  const padY = rect.height * paddingRatio;

  const cropX = clamp(Math.floor(rect.x - padX), 0, bitmap.width - 1);
  const cropY = clamp(Math.floor(rect.y - padY), 0, bitmap.height - 1);
  const cropRight = clamp(Math.ceil(rect.x + rect.width + padX), cropX + 1, bitmap.width);
  const cropBottom = clamp(Math.ceil(rect.y + rect.height + padY), cropY + 1, bitmap.height);
  const cropW = Math.max(1, cropRight - cropX);
  const cropH = Math.max(1, cropBottom - cropY);

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar o recorte da imagem.");
  }

  ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
  );
  if (!blob) {
    throw new Error("Não foi possível gerar o recorte da imagem.");
  }

  return new File([blob], outputName, { type: "image/jpeg", lastModified: Date.now() });
}

export async function cropFileByPixelRect(
  file: File,
  rect: PixelRect,
  outputName: string,
  paddingRatio = 0.08
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const clamped: PixelRect = {
      x: clamp(rect.x, 0, bitmap.width - 1),
      y: clamp(rect.y, 0, bitmap.height - 1),
      width: clamp(rect.width, 1, bitmap.width),
      height: clamp(rect.height, 1, bitmap.height),
    };
    clamped.width = Math.min(clamped.width, bitmap.width - clamped.x);
    clamped.height = Math.min(clamped.height, bitmap.height - clamped.y);
    return await cropBitmapRegion(bitmap, clamped, outputName, paddingRatio);
  } finally {
    bitmap.close();
  }
}

/** Recorta e comprime em uma única passagem (mais rápido). */
export async function cropAndCompressForOcr(
  file: File,
  rect: PixelRect,
  outputName = "selecao.jpg",
  paddingRatio = 0.04,
  maxSide = 720,
  quality = 0.78
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const padX = rect.width * paddingRatio;
    const padY = rect.height * paddingRatio;
    const cropX = clamp(Math.floor(rect.x - padX), 0, bitmap.width - 1);
    const cropY = clamp(Math.floor(rect.y - padY), 0, bitmap.height - 1);
    const cropRight = clamp(Math.ceil(rect.x + rect.width + padX), cropX + 1, bitmap.width);
    const cropBottom = clamp(Math.ceil(rect.y + rect.height + padY), cropY + 1, bitmap.height);
    let cropW = Math.max(1, cropRight - cropX);
    let cropH = Math.max(1, cropBottom - cropY);

    const minH = 64;
    const scaleUp = cropH < minH ? minH / cropH : 1;
    const scaleDown = Math.min(1, maxSide / Math.max(cropW * scaleUp, cropH * scaleUp));
    const scale = scaleUp * scaleDown;
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível preparar o recorte da imagem.");
    }
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob) {
      throw new Error("Não foi possível gerar o recorte da imagem.");
    }
    return new File([blob], outputName, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/** Reduz recorte pequeno antes do OCR (menos upload, resposta mais rápida). */
export async function comprimirRecorteParaOcr(
  file: File,
  maxSide = 720,
  quality = 0.78
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1 && file.size < 180_000) return file;
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
      );
      if (!blob) return file;
      return new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

export async function cropFileByNormalizedBox(
  file: File,
  box: CaixaNormalizada,
  outputName: string,
  paddingRatio = 0.16
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const x = (box.x / 1000) * bitmap.width;
    const y = (box.y / 1000) * bitmap.height;
    const width = (box.width / 1000) * bitmap.width;
    const height = (box.height / 1000) * bitmap.height;

    const padX = width * paddingRatio;
    const padY = height * paddingRatio;

    const cropX = clamp(Math.floor(x - padX), 0, bitmap.width - 1);
    const cropY = clamp(Math.floor(y - padY), 0, bitmap.height - 1);
    const cropRight = clamp(Math.ceil(x + width + padX), cropX + 1, bitmap.width);
    const cropBottom = clamp(Math.ceil(y + height + padY), cropY + 1, bitmap.height);
    const cropW = Math.max(1, cropRight - cropX);
    const cropH = Math.max(1, cropBottom - cropY);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível preparar o recorte da imagem.");
    }

    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) {
      throw new Error("Não foi possível gerar o recorte da imagem.");
    }

    return new File([blob], outputName, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
