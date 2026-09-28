import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MULTIPLICADOR_ANUAL_PADRAO,
  PLANOS_PADRAO,
  labelPontosDoPlano,
  montarBeneficiosPlano,
  normalizarBeneficiosExtras,
  normalizarPesosNichos,
  type FaixaPontos,
  type PesosNichos,
  type PlanoDefinicao,
} from "@/lib/pricing";

export type PrecosPayload = {
  planos: PlanoDefinicao[];
  multiplicador_anual: number;
  pesos_nichos: PesosNichos;
  fonte: "banco" | "padrao";
};

const COLUNAS_CATALOGO =
  "id, nome, descricao, destaque, ativo, ordem, faixa, limite_pontos, max_nichos, preco_mensal";

function colunaInexistente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /beneficios_extras/.test(error.message ?? "");
}

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
  beneficios_extras?: unknown;
}): PlanoDefinicao | null {
  const padrao = PLANOS_PADRAO.find((p) => p.slug === row.id || p.id === row.faixa);
  const faixa = (row.faixa || padrao?.id || "1-10") as FaixaPontos;
  const slug = (padrao?.slug ??
    (row.id as PlanoDefinicao["slug"])) as PlanoDefinicao["slug"];
  if (!["start", "growth", "pro", "elite"].includes(slug)) return null;

  const limitePontos = Number(row.limite_pontos ?? padrao?.limitePontos ?? 10);
  const maxNichos = Number(row.max_nichos ?? padrao?.maxNichos ?? 1);
  const precoMensal = Number(row.preco_mensal ?? padrao?.precoMensal ?? 0);
  const incluiIa = padrao?.incluiIa ?? precoMensal >= 499;
  const beneficiosExtras = normalizarBeneficiosExtras(row.beneficios_extras);
  const base = {
    id: faixa,
    slug,
    limitePontos,
    maxNichos,
    precoMensal,
    incluiIa,
    beneficiosExtras,
  } as const;

  return {
    id: faixa,
    slug,
    nome: row.nome || padrao?.nome || slug,
    descricao: row.descricao ?? padrao?.descricao ?? "",
    beneficios: montarBeneficiosPlano(base),
    beneficiosExtras: beneficiosExtras.length > 0 ? beneficiosExtras : null,
    incluiIa,
    labelPontos: labelPontosDoPlano(base),
    limitePontos,
    maxNichos,
    precoMensal,
    destaque: Boolean(row.destaque),
  };
}

async function carregarLinhasCatalogo(admin: SupabaseClient) {
  const comExtras = await admin
    .from("plataforma_planos_catalogo")
    .select(`${COLUNAS_CATALOGO}, beneficios_extras`)
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  // Sem a migração de benefícios, o catálogo continua valendo (sem os extras).
  if (!colunaInexistente(comExtras.error)) return comExtras;
  return admin
    .from("plataforma_planos_catalogo")
    .select(COLUNAS_CATALOGO)
    .eq("ativo", true)
    .order("ordem", { ascending: true });
}

export async function loadPrecosPayload(
  admin: SupabaseClient
): Promise<PrecosPayload> {
  let planos = PLANOS_PADRAO.map((p) => ({ ...p }));
  let fonte: "banco" | "padrao" = "padrao";
  let multiplicador_anual = MULTIPLICADOR_ANUAL_PADRAO;

  const { data: rows, error } = await carregarLinhasCatalogo(admin);

  if (!error && rows && rows.length > 0) {
    const mapped = rows
      .map((r) => rowToPlano(r))
      .filter((p): p is PlanoDefinicao => p != null);
    if (mapped.length > 0) {
      planos = mapped;
      fonte = "banco";
    }
  }

  const { data: cfgRows } = await admin
    .from("plataforma_config")
    .select("chave, valor")
    .in("chave", ["multiplicador_anual", "pesos_nichos"]);
  const cfg = new Map((cfgRows ?? []).map((r) => [r.chave as string, r.valor]));

  const mult = cfg.get("multiplicador_anual");
  if (mult != null) {
    const n = Number(mult);
    if (Number.isFinite(n) && n > 0) multiplicador_anual = n;
  }

  return {
    planos,
    multiplicador_anual,
    pesos_nichos: normalizarPesosNichos(cfg.get("pesos_nichos")),
    fonte,
  };
}

export async function savePrecosPayload(
  admin: SupabaseClient,
  input: {
    planos: PlanoDefinicao[];
    multiplicador_anual: number;
    pesos_nichos?: unknown;
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
    const extras = normalizarBeneficiosExtras(p.beneficiosExtras);
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
      beneficios_extras: extras.length > 0 ? extras : null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      if (colunaInexistente(error)) {
        return {
          ok: false,
          error: "Rode supabase/plataforma-precos-pesos-beneficios.sql no Supabase.",
        };
      }
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
  const agora = new Date().toISOString();
  const configs: { chave: string; valor: unknown; updated_at: string }[] = [
    { chave: "multiplicador_anual", valor: mult, updated_at: agora },
  ];
  if (input.pesos_nichos !== undefined) {
    configs.push({
      chave: "pesos_nichos",
      valor: normalizarPesosNichos(input.pesos_nichos),
      updated_at: agora,
    });
  }
  const { error: cfgErr } = await admin.from("plataforma_config").upsert(configs);
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
