import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLATAFORMA_ASSETS_BUCKET,
  validarCoverNicho,
} from "@/lib/dono/nicho-covers";
import {
  normalizarProvaSocial,
  PROVA_SOCIAL_CONFIG_KEY,
  type ProvaSocial,
} from "@/lib/marketing/prova-social";

export async function loadProvaSocial(admin: SupabaseClient): Promise<ProvaSocial> {
  const { data } = await admin
    .from("plataforma_config")
    .select("valor")
    .eq("chave", PROVA_SOCIAL_CONFIG_KEY)
    .maybeSingle();
  return normalizarProvaSocial(data?.valor);
}

export async function saveProvaSocial(
  admin: SupabaseClient,
  valor: unknown
): Promise<{ ok: true; prova: ProvaSocial } | { ok: false; error: string }> {
  const prova = normalizarProvaSocial(valor);
  const { error } = await admin.from("plataforma_config").upsert({
    chave: PROVA_SOCIAL_CONFIG_KEY,
    valor: prova,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42P01"
          ? "Rode supabase/plataforma-precos.sql no Supabase."
          : error.message,
    };
  }
  return { ok: true, prova };
}

export async function uploadFotoDepoimento(
  admin: SupabaseClient,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const erro = validarCoverNicho(file);
  if (erro) return { ok: false, error: erro };

  let mime = (file.type || "").toLowerCase();
  if (mime === "image/jpg" || mime === "image/pjpeg") mime = "image/jpeg";
  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const path = `depoimentos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(PLATAFORMA_ASSETS_BUCKET)
    .upload(path, file, { contentType: mime });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("Bucket not found")
        ? "Bucket plataforma-assets não existe. Rode supabase/plataforma-nichos-covers.sql."
        : error.message,
    };
  }
  const { data } = admin.storage.from(PLATAFORMA_ASSETS_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
