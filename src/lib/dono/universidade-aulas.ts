import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UNIVERSIDADE_AULAS,
  type UniversidadeAula,
  type UniversidadeModulo,
} from "@/lib/universidade/aulas";

export type UniversidadeAulaAdmin = UniversidadeAula & {
  publicado: boolean;
  ordem: number;
};

export type UniversidadeAulasPayload = {
  aulas: UniversidadeAulaAdmin[];
  fonte: "banco" | "padrao";
};

const MODULOS_OK = new Set<UniversidadeModulo>([
  "comecar",
  "pontos",
  "coletas",
  "financeiro",
  "equipe",
  "rotas",
  "planos",
  "nichos",
]);

/** Extrai ID do YouTube de URL completa ou do próprio ID. */
export function extrairYoutubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const embed = u.pathname.match(/\/embed\/([\w-]{11})/);
    if (embed?.[1]) return embed[1];
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/);
    if (shorts?.[1]) return shorts[1];
  } catch {
    // ignore
  }
  return null;
}

function defaultsAdmin(): UniversidadeAulaAdmin[] {
  return UNIVERSIDADE_AULAS.map((a, i) => ({
    ...a,
    publicado: true,
    ordem: i + 1,
  }));
}

function rowToAula(row: {
  id: string;
  titulo: string;
  descricao: string | null;
  modulo: string;
  duracao: string | null;
  youtube_id: string | null;
  publicado?: boolean | null;
  ordem?: number | null;
}): UniversidadeAulaAdmin | null {
  const modulo = (MODULOS_OK.has(row.modulo as UniversidadeModulo)
    ? row.modulo
    : "comecar") as UniversidadeModulo;
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao ?? "",
    modulo,
    duracao: row.duracao ?? "",
    youtubeId: row.youtube_id || null,
    publicado: row.publicado !== false,
    ordem: Number(row.ordem ?? 0),
  };
}

export async function loadUniversidadeAulasAdmin(
  admin: SupabaseClient
): Promise<UniversidadeAulasPayload> {
  const { data: rows, error } = await admin
    .from("plataforma_universidade_aulas")
    .select("id, titulo, descricao, modulo, duracao, youtube_id, publicado, ordem")
    .order("ordem", { ascending: true });

  if (error || !rows?.length) {
    return { aulas: defaultsAdmin(), fonte: "padrao" };
  }

  const aulas = rows
    .map((r) => rowToAula(r))
    .filter((a): a is UniversidadeAulaAdmin => a != null);

  return {
    aulas: aulas.length ? aulas : defaultsAdmin(),
    fonte: aulas.length ? "banco" : "padrao",
  };
}

/** Catálogo público: só aulas marcadas como publicadas. */
export async function loadUniversidadeAulasPublic(
  admin: SupabaseClient
): Promise<{ aulas: UniversidadeAula[]; fonte: "banco" | "padrao" }> {
  const { data: rows, error } = await admin
    .from("plataforma_universidade_aulas")
    .select("id, titulo, descricao, modulo, duracao, youtube_id, publicado, ordem")
    .eq("publicado", true)
    .order("ordem", { ascending: true });

  if (error || !rows?.length) {
    return {
      aulas: UNIVERSIDADE_AULAS.map((a) => ({ ...a })),
      fonte: "padrao",
    };
  }

  const aulas = rows
    .map((r) => rowToAula(r))
    .filter((a): a is UniversidadeAulaAdmin => a != null)
    .map(({ publicado: _p, ordem: _o, ...aula }) => aula);

  return {
    aulas: aulas.length ? aulas : UNIVERSIDADE_AULAS.map((a) => ({ ...a })),
    fonte: aulas.length ? "banco" : "padrao",
  };
}

export async function saveUniversidadeAula(
  admin: SupabaseClient,
  input: {
    id: string;
    titulo: string;
    descricao: string;
    modulo: UniversidadeModulo;
    duracao: string;
    youtubeUrlOrId: string | null;
    publicado: boolean;
    ordem?: number;
  }
): Promise<{ ok: true; aula: UniversidadeAulaAdmin } | { ok: false; error: string }> {
  const id = input.id.trim();
  if (!id) return { ok: false, error: "ID da aula inválido." };

  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: "Informe o título." };

  if (!MODULOS_OK.has(input.modulo)) {
    return { ok: false, error: "Módulo inválido." };
  }

  const youtubeId = extrairYoutubeId(input.youtubeUrlOrId);
  if (input.youtubeUrlOrId?.trim() && !youtubeId) {
    return {
      ok: false,
      error: "Link do YouTube inválido. Cole a URL completa ou o ID do vídeo.",
    };
  }

  let ordem = input.ordem;
  if (ordem == null) {
    const { data: maxRow } = await admin
      .from("plataforma_universidade_aulas")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    ordem = Number(maxRow?.ordem ?? 0) + 1;
  }

  const { error } = await admin.from("plataforma_universidade_aulas").upsert({
    id,
    titulo,
    descricao: input.descricao.trim(),
    modulo: input.modulo,
    duracao: input.duracao.trim(),
    youtube_id: youtubeId,
    publicado: Boolean(input.publicado),
    ordem,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Tabela ainda não existe. Rode supabase/plataforma-universidade.sql no Supabase SQL Editor.",
      };
    }
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    aula: {
      id,
      titulo,
      descricao: input.descricao.trim(),
      modulo: input.modulo,
      duracao: input.duracao.trim(),
      youtubeId,
      publicado: Boolean(input.publicado),
      ordem,
    },
  };
}

/** Gera id estável a partir do título. */
export function slugAulaId(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base || "aula"}-${suffix}`;
}

export async function criarUniversidadeAula(
  admin: SupabaseClient,
  input?: { titulo?: string; modulo?: UniversidadeModulo }
): Promise<{ ok: true; aula: UniversidadeAulaAdmin } | { ok: false; error: string }> {
  await seedUniversidadeAulasSeVazio(admin).catch(() => null);

  const titulo = (input?.titulo ?? "Nova aula").trim() || "Nova aula";
  const modulo = input?.modulo && MODULOS_OK.has(input.modulo) ? input.modulo : "comecar";
  const id = slugAulaId(titulo);

  return saveUniversidadeAula(admin, {
    id,
    titulo,
    descricao: "",
    modulo,
    duracao: "",
    youtubeUrlOrId: null,
    publicado: true,
  });
}

export async function excluirUniversidadeAula(
  admin: SupabaseClient,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = id.trim();
  if (!clean) return { ok: false, error: "ID inválido." };

  const { error } = await admin
    .from("plataforma_universidade_aulas")
    .delete()
    .eq("id", clean);

  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Tabela ainda não existe. Rode supabase/plataforma-universidade.sql no Supabase SQL Editor.",
      };
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function seedUniversidadeAulasSeVazio(
  admin: SupabaseClient
): Promise<void> {
  const { count } = await admin
    .from("plataforma_universidade_aulas")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  for (const [i, a] of UNIVERSIDADE_AULAS.entries()) {
    await admin.from("plataforma_universidade_aulas").upsert({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      modulo: a.modulo,
      duracao: a.duracao,
      youtube_id: a.youtubeId,
      publicado: true,
      ordem: i + 1,
      updated_at: new Date().toISOString(),
    });
  }
}
