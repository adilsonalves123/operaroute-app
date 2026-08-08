import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "suporte-anexos";
export const SUPORTE_ANEXO_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/avif",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
]);

function sanitizeNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 8) return fromName === "jpeg" ? "jpg" : fromName;
  const mime = (file.type || "").split("/")[1]?.toLowerCase() ?? "bin";
  return mime === "jpeg" ? "jpg" : mime;
}

export function normalizarMimeAnexo(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (t === "image/heif") return "image/heic";
  if (ALLOWED.has(t)) return t;

  const ext = extFromFile(file);
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "doc") return "application/msword";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "zip") return "application/zip";
  return t || "application/octet-stream";
}

export function validarArquivoSuporte(file: File): string | null {
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > SUPORTE_ANEXO_MAX_BYTES) return "Arquivo acima de 10 MB.";
  const mime = normalizarMimeAnexo(file);
  if (!ALLOWED.has(mime)) {
    return "Tipo não permitido. Use foto, PDF, Word, Excel, TXT ou ZIP.";
  }
  return null;
}

export type AnexoSuporte = {
  url: string;
  nome: string;
  mime: string;
  tamanho: number;
};

export async function uploadAnexoSuporte(
  supabase: SupabaseClient,
  empresaId: string,
  conversaId: string,
  file: File
): Promise<AnexoSuporte> {
  const erro = validarArquivoSuporte(file);
  if (erro) throw new Error(erro);

  const mime = normalizarMimeAnexo(file);
  const nomeSafe = sanitizeNome(file.name || `anexo.${extFromFile(file)}`);
  const path = `${empresaId}/${conversaId}/${Date.now()}-${nomeSafe}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: mime,
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "Bucket suporte-anexos não existe. Rode supabase/suporte-anexos.sql."
        : error.message
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    nome: file.name || nomeSafe,
    mime,
    tamanho: file.size,
  };
}

export function isImagemMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith("image/"));
}
