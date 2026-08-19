import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
