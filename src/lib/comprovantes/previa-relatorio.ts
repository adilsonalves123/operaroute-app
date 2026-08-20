import { createClient } from "@/lib/supabase/client";
import {
  blobParaDataUrlCompacto,
  comprimirImagemParaJpeg,
  MAX_DATA_URL_BYTES,
} from "@/lib/storage/comprimir-foto-cliente";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

async function uploadJpegPublico(jpeg: Blob, empresaId: string): Promise<string | null> {
  const supabase = createClient();
  const path = `${empresaId}/previas/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from("coleta-fotos").upload(path, jpeg, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) return null;
  const { data } = supabase.storage.from("coleta-fotos").getPublicUrl(path);
  return data.publicUrl;
}

async function blobParaUrlComprovante(blob: Blob, empresaId: string | null): Promise<string | null> {
  const jpeg = await comprimirImagemParaJpeg(blob, { maxBytes: 180_000, maxSide: 1280 });
  if (empresaId) {
    const publicUrl = await uploadJpegPublico(jpeg, empresaId);
    if (publicUrl) return publicUrl;
  }
  if (jpeg.size <= MAX_DATA_URL_BYTES) {
    return blobParaDataUrlCompacto(jpeg);
  }
  // Não embute foto grande no JSON — estoura o limite da função (HTTP 413).
  return null;
}

async function resolverUrlFoto(
  url: string | null | undefined,
  empresaId: string | null
): Promise<string | null | undefined> {
  if (!url) return url;
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }

  if (url.startsWith("data:image")) {
    if (url.length <= MAX_DATA_URL_BYTES) return url;
    try {
      const blob = await (await fetch(url)).blob();
      return blobParaUrlComprovante(blob, empresaId);
    } catch {
      return null;
    }
  }

  if (!url.startsWith("blob:")) return url;

  try {
    const blob = await (await fetch(url)).blob();
    return blobParaUrlComprovante(blob, empresaId);
  } catch {
    return null;
  }
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
          (k === "fotoUrl" || k === "foto_url" || k === "fotoUri") &&
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
