import { CASSINO_IA_THRESHOLDS } from "@/lib/nichos/cassino/ia-thresholds";

export type PhotoQualityAnalysis = {
  ok: boolean;
  reasons: string[];
  metrics: {
    width: number;
    height: number;
    averageLuminance: number;
    darkRatio: number;
    brightRatio: number;
    focusScore: number;
  };
};

/**
 * Faz uma checagem leve no cliente antes de mandar a foto para a IA.
 * Não tenta provar que a imagem está perfeita; só barra casos claramente ruins.
 */
export async function analyzePhotoQuality(file: File): Promise<PhotoQualityAnalysis> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      ok: false,
      reasons: ["Não foi possível abrir a imagem desta foto."],
      metrics: {
        width: 0,
        height: 0,
        averageLuminance: 0,
        darkRatio: 0,
        brightRatio: 0,
        focusScore: 0,
      },
    };
  }

  const width = bitmap.width;
  const height = bitmap.height;
  const maxSide = CASSINO_IA_THRESHOLDS.photoQuality.maxSampleSide;
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  const sampleW = Math.max(32, Math.round(width * scale));
  const sampleH = Math.max(32, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return {
      ok: false,
      reasons: ["Não foi possível processar a imagem desta foto."],
      metrics: {
        width,
        height,
        averageLuminance: 0,
        darkRatio: 0,
        brightRatio: 0,
        focusScore: 0,
      },
    };
  }

  ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  const gray = new Float32Array(sampleW * sampleH);
  let luminanceSum = 0;
  let darkCount = 0;
  let brightCount = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[p] = y;
    luminanceSum += y;
    if (y < CASSINO_IA_THRESHOLDS.photoQuality.darkPixelThreshold) darkCount += 1;
    if (y > CASSINO_IA_THRESHOLDS.photoQuality.brightPixelThreshold) brightCount += 1;
  }

  let focusAccumulator = 0;
  let focusPixels = 0;
  for (let y = 1; y < sampleH - 1; y += 1) {
    for (let x = 1; x < sampleW - 1; x += 1) {
      const i = y * sampleW + x;
      const laplacian = Math.abs(
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - sampleW] - gray[i + sampleW]
      );
      focusAccumulator += laplacian;
      focusPixels += 1;
    }
  }

  const totalPixels = Math.max(1, sampleW * sampleH);
  const averageLuminance = luminanceSum / totalPixels;
  const darkRatio = darkCount / totalPixels;
  const brightRatio = brightCount / totalPixels;
  const focusScore = focusPixels > 0 ? focusAccumulator / focusPixels : 0;

  const reasons: string[] = [];
  const tooSmall = Math.min(width, height) < 400;
  const veryDark =
    averageLuminance < 24 ||
    (averageLuminance < CASSINO_IA_THRESHOLDS.photoQuality.minAverageLuminance &&
      darkRatio > CASSINO_IA_THRESHOLDS.photoQuality.maxDarkRatio);
  const veryBright =
    brightRatio > CASSINO_IA_THRESHOLDS.photoQuality.maxBrightRatio + 0.12 ||
    averageLuminance > CASSINO_IA_THRESHOLDS.photoQuality.maxAverageLuminance + 12;
  const veryBlurry =
    focusScore < CASSINO_IA_THRESHOLDS.photoQuality.minFocusScore - 3 &&
    averageLuminance < 55;

  if (tooSmall) {
    reasons.push("Resolução baixa para ler o visor com segurança.");
  }
  if (veryDark) {
    reasons.push("Imagem escura demais.");
  }
  if (veryBright) {
    reasons.push("Reflexo ou luz estourada no visor.");
  }
  if (veryBlurry) {
    reasons.push("Foto borrada ou sem nitidez suficiente.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    metrics: {
      width,
      height,
      averageLuminance,
      darkRatio,
      brightRatio,
      focusScore,
    },
  };
}
