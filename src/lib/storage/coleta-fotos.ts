import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "coleta-fotos";

function extFromFile(file: File | Blob & { name?: string }): string {
  const name = "name" in file && file.name ? file.name : "";
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  const rawType = (file.type || "").split("/")[1]?.toLowerCase() ?? "";
  if (rawType === "jpeg" || rawType === "jpg") return "jpg";
  if (["png", "webp", "heic", "heif", "avif"].includes(rawType)) return rawType;
  return "jpg";
}

/** Normaliza MIME para o allowlist do bucket coleta-fotos. */
export function mimeTypeFoto(file: File | Blob): string {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (t === "image/heif") return "image/heic";
  if (["image/jpeg", "image/png", "image/webp", "image/heic", "image/avif"].includes(t)) {
    return t;
  }
  const ext = extFromFile(file as File);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

async function uploadNoBucket(
  supabase: SupabaseClient,
  path: string,
  file: File | Blob,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType,
  });

  if (!error) return;

  // Upsert às vezes falha sem policy UPDATE completa — tenta remove + insert.
  if (
    error.message.toLowerCase().includes("row-level security") ||
    error.message.toLowerCase().includes("already exists") ||
    error.message.toLowerCase().includes("duplicate") ||
    error.message.toLowerCase().includes("policy")
  ) {
    await supabase.storage.from(BUCKET).remove([path]);
    const retry = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType,
    });
    if (!retry.error) return;
    throw new Error(
      retry.error.message.includes("Bucket not found")
        ? "Bucket coleta-fotos não existe. Rode supabase/storage-coleta.sql."
        : retry.error.message
    );
  }

  throw new Error(
    error.message.includes("Bucket not found")
      ? "Bucket coleta-fotos não existe. Rode supabase/storage-coleta.sql."
      : error.message
  );
}

export async function uploadFotoMaquina(
  supabase: SupabaseClient,
  empresaId: string,
  equipamentoId: string,
  file: File,
  visitaFolder: string
): Promise<string> {
  const ext = extFromFile(file);
  const path = `${empresaId}/fotos_coleta/${visitaFolder}/${equipamentoId}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadRelatorioImagem(
  supabase: SupabaseClient,
  empresaId: string,
  visitaId: string,
  blob: Blob,
  previa: boolean
): Promise<string> {
  const suffix = previa ? "previa" : "final";
  const path = `${empresaId}/relatorios/${visitaId}/${suffix}.png`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/png",
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoFuraFura(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string,
  file: File
): Promise<string> {
  const ext = extFromFile(file);
  const path = `${empresaId}/fotos_fura/${pontoId}/${Date.now()}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoEstoque(
  supabase: SupabaseClient,
  empresaId: string,
  itemId: string,
  file: File | Blob
): Promise<string> {
  const ext = extFromFile(file as File);
  // timestamp evita conflito de extensão (jpg vs png) e força INSERT limpo
  const path = `${empresaId}/estoque/${itemId}-${Date.now()}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoProdutoConsignado(
  supabase: SupabaseClient,
  empresaId: string,
  produtoId: string,
  file: File | Blob
): Promise<string> {
  const ext = extFromFile(file as File);
  const path = `${empresaId}/produtos-consignados/${produtoId}-${Date.now()}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoPonto(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string,
  file: File
): Promise<string> {
  const ext = extFromFile(file);
  const path = `${empresaId}/pontos/${pontoId}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoKit(
  supabase: SupabaseClient,
  empresaId: string,
  kitId: string,
  file: File
): Promise<string> {
  const ext = extFromFile(file);
  const path = `${empresaId}/kits/${kitId}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotoEquipamento(
  supabase: SupabaseClient,
  empresaId: string,
  equipamentoId: string,
  file: File
): Promise<string> {
  const ext = extFromFile(file);
  const path = `${empresaId}/equipamentos/${equipamentoId}.${ext}`;
  await uploadNoBucket(supabase, path, file, mimeTypeFoto(file));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFotosMaquinasParalelo(
  supabase: SupabaseClient,
  empresaId: string,
  visitaFolder: string,
  fotos: { equipamentoId: string; file: File }[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    fotos.map(async ({ equipamentoId, file }) => {
      const url = await uploadFotoMaquina(
        supabase,
        empresaId,
        equipamentoId,
        file,
        visitaFolder
      );
      urls.set(equipamentoId, url);
    })
  );
  return urls;
}
