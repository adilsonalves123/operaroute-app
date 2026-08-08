import { createClient } from "@/lib/supabase/client";
import { mimeTypeFoto } from "@/lib/storage/coleta-fotos";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

async function blobUrlToPublicUrl(blobUrl: string, empresaId: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  const supabase = createClient();
  const ext =
    (blob.type || "").includes("png")
      ? "png"
      : (blob.type || "").includes("webp")
        ? "webp"
        : "jpg";
  const path = `${empresaId}/previas/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from("coleta-fotos").upload(path, blob, {
    upsert: true,
    contentType: mimeTypeFoto(blob),
  });
  if (error) {
    // Fallback: data URL (funciona sem storage; payload maior).
    return blobUrlToDataUrl(blob);
  }
  const { data } = supabase.storage.from("coleta-fotos").getPublicUrl(path);
  return data.publicUrl;
}

function blobUrlToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler foto da prévia."));
    reader.readAsDataURL(blob);
  });
}

async function resolverUrlFoto(
  url: string | null | undefined,
  empresaId: string | null
): Promise<string | null | undefined> {
  if (!url) return url;
  if (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  if (!url.startsWith("blob:")) return url;
  if (!empresaId) {
    const res = await fetch(url);
    return blobUrlToDataUrl(await res.blob());
  }
  return blobUrlToPublicUrl(url, empresaId);
}

async function empresaIdAtual(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.empresa_id ?? null;
  } catch {
    return null;
  }
}

/** Troca blob: por URL pública/data URL em qualquer árvore de relatório. */
export async function resolverFotosNoRelatorio<T>(relatorio: T): Promise<T> {
  const empresaId = await empresaIdAtual();
  const walk = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) {
      return Promise.all(value.map((v) => walk(v)));
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (
          (k === "fotoUrl" || k === "foto_url") &&
          typeof v === "string"
        ) {
          out[k] = await resolverUrlFoto(v, empresaId);
        } else {
          out[k] = await walk(v);
        }
      }
      return out;
    }
    return value;
  };
  return (await walk(relatorio)) as T;
}

export function serializarRelatorioParaSnapshot(
  data: Record<string, unknown> & { data?: Date | string; previa?: boolean },
  previa: boolean
): Record<string, unknown> {
  const dataIso =
    data.data instanceof Date
      ? data.data.toISOString()
      : typeof data.data === "string"
        ? data.data
        : new Date().toISOString();
  return {
    ...data,
    data: dataIso,
    previa,
  };
}

/** Snapshot do link detalhado (mesmo layout do histórico), com fotos. */
export async function montarSnapshotRelatorio(opts: {
  base: ComprovanteSnapshot;
  nichoModulo: NonNullable<ComprovanteSnapshot["nichoModulo"]>;
  relatorio: Record<string, unknown> & { data?: Date | string };
  previa?: boolean;
  /** Padrão `historico` (igual cassino). Use `relatorio` só para o card PNG legado. */
  layout?: NonNullable<ComprovanteSnapshot["layout"]>;
}): Promise<ComprovanteSnapshot> {
  const previa = opts.previa === true;
  const serializado = serializarRelatorioParaSnapshot(
    { ...opts.relatorio, previa },
    previa
  );
  const comFotos = await resolverFotosNoRelatorio(serializado);
  return {
    ...opts.base,
    previa,
    layout: opts.layout ?? "historico",
    nichoModulo: opts.nichoModulo,
    relatorio: comFotos,
  };
}

/** @deprecated use montarSnapshotRelatorio */
export async function montarSnapshotPreviaRelatorio(opts: {
  base: ComprovanteSnapshot;
  nichoModulo: NonNullable<ComprovanteSnapshot["nichoModulo"]>;
  relatorio: Record<string, unknown> & { data?: Date | string };
}): Promise<ComprovanteSnapshot> {
  return montarSnapshotRelatorio({ ...opts, previa: true });
}
