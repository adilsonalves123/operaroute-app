import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "coleta-fotos";

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) return fromName;
  const fromType = file.type.split("/")[1];
  return fromType === "jpeg" ? "jpg" : fromType || "jpg";
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

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "Bucket coleta-fotos não existe. Rode supabase/storage-coleta.sql."
        : error.message
    );
  }

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

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "Bucket coleta-fotos não existe. Rode supabase/storage-coleta.sql."
        : error.message
    );
  }

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
