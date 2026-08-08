import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MULTIPLICADOR_ANUAL_PADRAO,
  PLANOS_PADRAO,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";

export type PrecosPayload = {
  planos: PlanoDefinicao[];
  multiplicador_anual: number;
  fonte: "banco" | "padrao";
};

function rowToPlano(row: {
  id: string;
  nome: string;
  descricao: string | null;
  destaque?: boolean | null;
  ativo?: boolean | null;
  ordem?: number | null;
  faixa?: string | null;
  limite_pontos?: number | null;
  max_nichos?: number | null;
  preco_mensal?: number | null;
}): PlanoDefinicao | null {
  const padrao = PLANOS_PADRAO.find((p) => p.slug === row.id || p.id === row.faixa);
  const faixa = (row.faixa || padrao?.id || "1-10") as FaixaPontos;
  const slug = (padrao?.slug ??
    (row.id as PlanoDefinicao["slug"])) as PlanoDefinicao["slug"];
  if (!["start", "growth", "pro", "elite"].includes(slug)) return null;

  return {
    id: faixa,
    slug,
    nome: row.nome || padrao?.nome || slug,
    descricao: row.descricao ?? padrao?.descricao ?? "",
    labelPontos: padrao?.labelPontos ?? faixa,
    limitePontos: Number(row.limite_pontos ?? padrao?.limitePontos ?? 10),
    maxNichos: Number(row.max_nichos ?? padrao?.maxNichos ?? 1),
    precoMensal: Number(row.preco_mensal ?? padrao?.precoMensal ?? 0),
    destaque: Boolean(row.destaque),
  };
}

export async function loadPrecosPayload(
  admin: SupabaseClient
): Promise<PrecosPayload> {
  let planos = PLANOS_PADRAO.map((p) => ({ ...p }));
  let fonte: "banco" | "padrao" = "padrao";
  let multiplicador_anual = MULTIPLICADOR_ANUAL_PADRAO;

  const { data: rows, error } = await admin
    .from("plataforma_planos_catalogo")
    .select(
      "id, nome, descricao, destaque, ativo, ordem, faixa, limite_pontos, max_nichos, preco_mensal"
    )
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (!error && rows && rows.length > 0) {
    const mapped = rows
      .map((r) => rowToPlano(r))
      .filter((p): p is PlanoDefinicao => p != null);
    if (mapped.length > 0) {
      planos = mapped;
      fonte = "banco";
    }
  }

  const { data: cfg } = await admin
    .from("plataforma_config")
    .select("valor")
    .eq("chave", "multiplicador_anual")
    .maybeSingle();
  if (cfg?.valor != null) {
    const n = Number(cfg.valor);
    if (Number.isFinite(n) && n > 0) multiplicador_anual = n;
  }

  return { planos, multiplicador_anual, fonte };
}

export async function savePrecosPayload(
  admin: SupabaseClient,
  input: {
    planos: PlanoDefinicao[];
    multiplicador_anual: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const p of input.planos) {
    if (!Number.isFinite(p.precoMensal) || p.precoMensal < 0) {
      return { ok: false, error: `Preço inválido no plano ${p.nome}.` };
    }
    if (!Number.isFinite(p.limitePontos) || p.limitePontos < 1) {
      return { ok: false, error: `Limite de pontos inválido em ${p.nome}.` };
    }
    if (!Number.isFinite(p.maxNichos) || p.maxNichos < 1) {
      return { ok: false, error: `Limite de nichos inválido em ${p.nome}.` };
    }
  }

  for (const p of input.planos) {
    const { error } = await admin.from("plataforma_planos_catalogo").upsert({
      id: p.slug,
      nome: p.nome.trim() || p.slug,
      descricao: p.descricao,
      destaque: Boolean(p.destaque),
      ativo: true,
      ordem:
        PLANOS_PADRAO.findIndex((x) => x.slug === p.slug) + 1 ||
        input.planos.indexOf(p) + 1,
      faixa: p.id,
      limite_pontos: p.limitePontos,
      max_nichos: p.maxNichos,
      preco_mensal: p.precoMensal,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("plataforma_planos") || error.code === "42P01"
            ? "Rode supabase/plataforma-precos.sql no Supabase."
            : error.message,
      };
    }
  }

  const mult = Math.min(
    24,
    Math.max(1, Number(input.multiplicador_anual) || MULTIPLICADOR_ANUAL_PADRAO)
  );
  const { error: cfgErr } = await admin.from("plataforma_config").upsert({
    chave: "multiplicador_anual",
    valor: mult,
    updated_at: new Date().toISOString(),
  });
  if (cfgErr) return { ok: false, error: cfgErr.message };

  return { ok: true };
}

/** @deprecated */
export type PlanoCatalogo = {
  id: string;
  nome: string;
  descricao: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
};
