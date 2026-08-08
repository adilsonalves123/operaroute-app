/**
 * Normaliza foto do tablet/celular para o bucket Supabase:
 * - converte AVIF/HEIC/GIF/sem MIME → JPEG
 * - redimensiona se muito grande (evita falha por tamanho)
 */
export async function normalizeFotoParaUpload(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  const isHeic =
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif");

  const needsConvert =
    !type ||
    type === "image/avif" ||
    type === "image/gif" ||
    isHeic ||
    name.endsWith(".avif") ||
    name.endsWith(".gif") ||
    file.size > 2.5 * 1024 * 1024;

  const alreadyOk =
    (type === "image/jpeg" || type === "image/png" || type === "image/webp") &&
    file.size <= 2.5 * 1024 * 1024;

  if (alreadyOk && !needsConvert) return file;

  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      if (isHeic) {
        throw new Error(
          "Este tablet enviou HEIC, que o navegador não abre. Tire a foto de novo pela câmera do app ou salve como JPG na galeria."
        );
      }
      throw new Error(
        "Não foi possível ler esta imagem. Tente outra foto ou use a câmera."
      );
    }

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("Não foi possível processar a imagem.");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) throw new Error("Não foi possível converter a imagem.");

    const base = (file.name || "foto").replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(
      "Este formato de imagem não é suportado. Use JPG ou PNG, ou tire a foto pela câmera."
    );
  }
}
