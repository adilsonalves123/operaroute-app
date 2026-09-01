"use client";

type OcrWorker = {
  recognize: (image: File | Blob) => Promise<{ data: { text: string; confidence: number } }>;
};

let workerPromise: Promise<OcrWorker> | null = null;

async function criarWorker(): Promise<OcrWorker> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
  });
  return worker;
}

/** Carrega o motor de OCR no tablet enquanto o usuário olha a foto. */
export function preaquecerOcrLocal() {
  if (typeof window === "undefined") return;
  if (!workerPromise) {
    workerPromise = criarWorker();
  }
}

function soDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/**
 * Lê dígitos no recorte sem ir à internet.
 * Retorna null se não tiver confiança suficiente.
 */
export async function lerDigitosRecorteLocal(file: File | Blob): Promise<string | null> {
  try {
    preaquecerOcrLocal();
    const worker = await (workerPromise ?? criarWorker());
    const { data } = await worker.recognize(file);
    const digitos = soDigitos(data.text);
    if (digitos.length < 4) return null;
    if (digitos.length >= 6) return digitos;
    if (data.confidence >= 45) return digitos;
    return null;
  } catch {
    return null;
  }
}
