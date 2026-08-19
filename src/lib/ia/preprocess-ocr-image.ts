function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Melhora um recorte pequeno de visor para leitura óptica:
 * - amplia
 * - converte para tons de cinza
 * - aplica contraste automático simples
 * - reforça nitidez leve
 */
export async function preprocessOcrCrop(
  file: File,
  outputName: string,
  scaleMultiplier = 2
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scaleMultiplier));
    canvas.height = Math.max(1, Math.round(bitmap.height * scaleMultiplier));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Não foi possível preparar a imagem para leitura.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = image;
    const gray = new Float32Array(width * height);

    let minLum = 255;
    let maxLum = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[p] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const range = Math.max(1, maxLum - minLum);
    const normalized = new Float32Array(gray.length);
    for (let i = 0; i < gray.length; i += 1) {
      normalized[i] = ((gray[i] - minLum) / range) * 255;
    }

    const sharpened = new Float32Array(normalized.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          sharpened[i] = normalized[i];
          continue;
        }
        const center = normalized[i];
        const neighbors =
          normalized[i - 1] +
          normalized[i + 1] +
          normalized[i - width] +
          normalized[i + width];
        sharpened[i] = center * 1.55 - neighbors * 0.1375;
      }
    }

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const lum = clampByte(sharpened[p]);
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
      data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.96)
    );
    if (!blob) {
      throw new Error("Não foi possível finalizar a imagem para leitura.");
    }

    return new File([blob], outputName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
