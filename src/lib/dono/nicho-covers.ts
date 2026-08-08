import type { SupabaseClient } from "@supabase/supabase-js";
import { NICHOS, NICHO_CARD_VISUAL, NICHO_CARDS_EXIBICAO } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";

export const NICHO_COVERS_CONFIG_KEY = "nicho_covers";
export const NICHO_CARDS_CONFIG_KEY = "nicho_cards";
export const PLATAFORMA_ASSETS_BUCKET = "plataforma-assets";
export const NICHO_COVER_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type NichoCardOverride = {
  cover?: string;
  pausado?: boolean;
  label?: string;
  descricao?: string;
};

export type NichoCardsMap = Partial<Record<Nicho, NichoCardOverride>>;
export type NichoCoversMap = Partial<Record<Nicho, string>>;

export type NichoCardItem = {
  id: Nicho;
  label: string;
  descricao: string;
  cover: string;
  customCover: boolean;
  pausado: boolean;
  labelCustom: boolean;
  descricaoCustom: boolean;
};

function isNicho(id: string): id is Nicho {
  return id in NICHO_CARD_VISUAL;
}

export function nichosEditaveisCovers(): Nicho[] {
  return [...NICHO_CARDS_EXIBICAO];
}

export function defaultNichoCovers(): Record<Nicho, string> {
  const out = {} as Record<Nicho, string>;
  for (const id of Object.keys(NICHO_CARD_VISUAL) as Nicho[]) {
    out[id] = NICHO_CARD_VISUAL[id].coverImage;
  }
  return out;
}

export function parseLegacyCovers(valor: unknown): NichoCoversMap {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: NichoCoversMap = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (!isNicho(k)) continue;
    if (typeof v === "string" && v.trim()) {
      out[k] = v.trim();
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const cover = (v as { cover?: unknown }).cover;
      if (typeof cover === "string" && cover.trim()) out[k] = cover.trim();
    }
  }
  return out;
}

export function parseNichoCardsValor(valor: unknown): NichoCardsMap {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: NichoCardsMap = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (!isNicho(k)) continue;
    if (typeof v === "string" && v.trim()) {
      out[k] = { cover: v.trim() };
      continue;
    }
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const entry: NichoCardOverride = {};
    if (typeof row.cover === "string" && row.cover.trim()) entry.cover = row.cover.trim();
    if (typeof row.pausado === "boolean") entry.pausado = row.pausado;
    if (typeof row.label === "string" && row.label.trim()) entry.label = row.label.trim();
    if (typeof row.descricao === "string" && row.descricao.trim()) {
      entry.descricao = row.descricao.trim();
    }
    if (Object.keys(entry).length) out[k] = entry;
  }
  return out;
}

export async function loadNichoCardsMap(admin: SupabaseClient): Promise<NichoCardsMap> {
  const [{ data: cards }, { data: covers }] = await Promise.all([
    admin
      .from("plataforma_config")
      .select("valor")
      .eq("chave", NICHO_CARDS_CONFIG_KEY)
      .maybeSingle(),
    admin
      .from("plataforma_config")
      .select("valor")
      .eq("chave", NICHO_COVERS_CONFIG_KEY)
      .maybeSingle(),
  ]);

  const map = parseNichoCardsValor(cards?.valor);
  const legacy = parseLegacyCovers(covers?.valor);
  for (const [id, url] of Object.entries(legacy) as [Nicho, string][]) {
    if (!map[id]?.cover) {
      map[id] = { ...map[id], cover: url };
    }
  }
  return map;
}

export async function saveNichoCardsMap(
  admin: SupabaseClient,
  map: NichoCardsMap
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean: Record<string, NichoCardOverride> = {};
  for (const id of nichosEditaveisCovers()) {
    const row = map[id];
    if (!row) continue;
    const entry: NichoCardOverride = {};
    if (row.cover?.trim()) entry.cover = row.cover.trim();
    if (row.pausado) entry.pausado = true;
    if (row.label?.trim()) entry.label = row.label.trim();
    if (row.descricao?.trim()) entry.descricao = row.descricao.trim();
    if (Object.keys(entry).length) clean[id] = entry;
  }

  const { error } = await admin.from("plataforma_config").upsert({
    chave: NICHO_CARDS_CONFIG_KEY,
    valor: clean,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function buildNichoCardItens(map: NichoCardsMap): NichoCardItem[] {
  return nichosEditaveisCovers().map((id) => {
    const row = map[id] ?? {};
    const padraoCover = NICHO_CARD_VISUAL[id].coverImage;
    const padraoLabel = NICHOS[id].label;
    const padraoDesc = NICHO_CARD_VISUAL[id].cardDescription;
    return {
      id,
      label: row.label?.trim() || padraoLabel,
      descricao: row.descricao?.trim() || padraoDesc,
      cover: row.cover?.trim() || padraoCover,
      customCover: Boolean(row.cover?.trim()),
      pausado: Boolean(row.pausado),
      labelCustom: Boolean(row.label?.trim()),
      descricaoCustom: Boolean(row.descricao?.trim()),
    };
  });
}

export function resolveCoversFromMap(map: NichoCardsMap): Record<Nicho, string> {
  const base = defaultNichoCovers();
  for (const id of Object.keys(map) as Nicho[]) {
    const cover = map[id]?.cover?.trim();
    if (cover) base[id] = cover;
  }
  return base;
}

export function ativosFromMap(map: NichoCardsMap): Nicho[] {
  return nichosEditaveisCovers().filter((id) => !map[id]?.pausado);
}

export function pausadosFromMap(map: NichoCardsMap): Nicho[] {
  return nichosEditaveisCovers().filter((id) => Boolean(map[id]?.pausado));
}

export async function loadNichoCoversResolved(
  admin: SupabaseClient
): Promise<Record<Nicho, string>> {
  return resolveCoversFromMap(await loadNichoCardsMap(admin));
}

export async function loadNichoCoversOverrides(
  admin: SupabaseClient
): Promise<NichoCoversMap> {
  const map = await loadNichoCardsMap(admin);
  const out: NichoCoversMap = {};
  for (const [id, row] of Object.entries(map) as [Nicho, NichoCardOverride][]) {
    if (row.cover?.trim()) out[id] = row.cover.trim();
  }
  return out;
}

export async function saveNichoCoversOverrides(
  admin: SupabaseClient,
  overrides: NichoCoversMap
): Promise<{ ok: true } | { ok: false; error: string }> {
  const map = await loadNichoCardsMap(admin);
  for (const id of nichosEditaveisCovers()) {
    const url = overrides[id]?.trim();
    if (url) {
      map[id] = { ...map[id], cover: url };
    } else if (map[id]) {
      const { cover: _c, ...rest } = map[id]!;
      void _c;
      map[id] = Object.keys(rest).length ? rest : undefined;
      if (!map[id]) delete map[id];
    }
  }
  return saveNichoCardsMap(admin, map);
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export function validarCoverNicho(file: File): string | null {
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > NICHO_COVER_MAX_BYTES) return "Imagem acima de 5 MB.";
  let mime = (file.type || "").toLowerCase();
  if (mime === "image/jpg" || mime === "image/pjpeg") mime = "image/jpeg";
  if (!ALLOWED_MIME.has(mime)) {
    return "Use JPEG, PNG, WebP ou GIF.";
  }
  return null;
}

export async function uploadNichoCover(
  admin: SupabaseClient,
  nicho: Nicho,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isNicho(nicho)) return { ok: false, error: "Nicho inválido." };
  const erro = validarCoverNicho(file);
  if (erro) return { ok: false, error: erro };

  let mime = (file.type || "").toLowerCase();
  if (mime === "image/jpg" || mime === "image/pjpeg") mime = "image/jpeg";
  const ext = extFromMime(mime);
  const path = `nichos/${nicho}-${Date.now()}.${ext}`;

  const { error } = await admin.storage
    .from(PLATAFORMA_ASSETS_BUCKET)
    .upload(path, file, { upsert: true, contentType: mime });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("Bucket not found")
        ? "Bucket plataforma-assets não existe. Rode supabase/plataforma-nichos-covers.sql."
        : error.message,
    };
  }

  const { data } = admin.storage.from(PLATAFORMA_ASSETS_BUCKET).getPublicUrl(path);
  const map = await loadNichoCardsMap(admin);
  map[nicho] = { ...map[nicho], cover: data.publicUrl };
  const saved = await saveNichoCardsMap(admin, map);
  if (!saved.ok) return saved;
  return { ok: true, url: data.publicUrl };
}

export async function resetNichoCover(
  admin: SupabaseClient,
  nicho: Nicho
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isNicho(nicho)) return { ok: false, error: "Nicho inválido." };
  const map = await loadNichoCardsMap(admin);
  if (map[nicho]) {
    const { cover: _c, ...rest } = map[nicho]!;
    void _c;
    if (Object.keys(rest).length) map[nicho] = rest;
    else delete map[nicho];
  }
  return saveNichoCardsMap(admin, map);
}

export async function updateNichoCard(
  admin: SupabaseClient,
  nicho: Nicho,
  patch: { pausado?: boolean; label?: string | null; descricao?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isNicho(nicho)) return { ok: false, error: "Nicho inválido." };
  const map = await loadNichoCardsMap(admin);
  const cur = { ...(map[nicho] ?? {}) };

  if (typeof patch.pausado === "boolean") {
    if (patch.pausado) cur.pausado = true;
    else delete cur.pausado;
  }
  if (patch.label === null) delete cur.label;
  else if (typeof patch.label === "string") {
    const t = patch.label.trim();
    if (t) cur.label = t;
    else delete cur.label;
  }
  if (patch.descricao === null) delete cur.descricao;
  else if (typeof patch.descricao === "string") {
    const t = patch.descricao.trim();
    if (t) cur.descricao = t;
    else delete cur.descricao;
  }

  if (Object.keys(cur).length) map[nicho] = cur;
  else delete map[nicho];

  return saveNichoCardsMap(admin, map);
}

export type NichoCatalogPublic = {
  covers: Record<Nicho, string>;
  labels: Partial<Record<Nicho, string>>;
  descricoes: Partial<Record<Nicho, string>>;
  ativos: Nicho[];
  pausados: Nicho[];
};

export async function loadNichoCatalogPublic(
  admin: SupabaseClient
): Promise<NichoCatalogPublic> {
  const map = await loadNichoCardsMap(admin);
  const covers = resolveCoversFromMap(map);
  const labels: Partial<Record<Nicho, string>> = {};
  const descricoes: Partial<Record<Nicho, string>> = {};
  for (const id of nichosEditaveisCovers()) {
    if (map[id]?.label?.trim()) labels[id] = map[id]!.label!.trim();
    if (map[id]?.descricao?.trim()) descricoes[id] = map[id]!.descricao!.trim();
  }
  return {
    covers,
    labels,
    descricoes,
    ativos: ativosFromMap(map),
    pausados: pausadosFromMap(map),
  };
}
