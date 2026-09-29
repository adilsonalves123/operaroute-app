"use client";

import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { resolveNichosAtivos } from "@/lib/assinatura";
import type { Nicho } from "@/lib/types/database";
import {
  CACHE_DADOS,
  CACHE_ESTATICOS,
  CACHE_PAGINAS,
  HEADER_SALVO_EM,
  avisarCampoMudou,
  campoDisponivel,
  salvarMeta,
  salvarTabelas,
  type EscopoRetrato,
  type LinhaRetrato,
  type RetratoTabela,
} from "@/lib/offline/campo-db";
import { paginasDoCampo } from "@/lib/offline/campo-rotas";

const PAGINA_SUPABASE = 1000;
const DOWNLOADS_SIMULTANEOS = 4;

type SupabaseBrowser = ReturnType<typeof createClient>;

type DefinicaoTabela = {
  nome: string;
  select: string;
  limite: number;
  escopo: EscopoRetrato | null;
  filtrar: (q: FiltroQuery, ctx: { empresaId: string; userId: string }) => FiltroQuery;
};

type RespostaPagina = { data: LinhaRetrato[] | null; error: unknown };
type FiltroQuery = {
  eq: (coluna: string, valor: string) => FiltroQuery;
  order: (coluna: string, opcoes: { ascending: boolean }) => FiltroQuery;
  range: (de: number, ate: number) => PromiseLike<RespostaPagina>;
};

/** O que os formulários de coleta leem ao abrir. Escopo = o que foi baixado (ver sw-offline.js). */
const TABELAS: DefinicaoTabela[] = [
  { nome: "pontos", select: "*", limite: 5000, escopo: null, filtrar: (q, c) => q.eq("empresa_id", c.empresaId) },
  { nome: "equipamentos", select: "*", limite: 10000, escopo: null, filtrar: (q, c) => q.eq("empresa_id", c.empresaId) },
  {
    nome: "pendencias",
    select: "*",
    limite: 10000,
    escopo: { obrigatorios: { status: "aberta" } },
    filtrar: (q, c) => q.eq("empresa_id", c.empresaId).eq("status", "aberta"),
  },
  {
    nome: "empresas",
    select: "*",
    limite: 1,
    escopo: { chaves: ["id"] },
    filtrar: (q, c) => q.eq("id", c.empresaId),
  },
  {
    nome: "profiles",
    select: "*",
    limite: 1,
    escopo: { chaves: ["user_id"] },
    filtrar: (q, c) => q.eq("user_id", c.userId),
  },
  { nome: "produtos_consignados", select: "*", limite: 5000, escopo: null, filtrar: (q, c) => q.eq("empresa_id", c.empresaId) },
  { nome: "estoque", select: "*", limite: 5000, escopo: null, filtrar: (q, c) => q.eq("empresa_id", c.empresaId) },
  { nome: "financeiro", select: "id, empresa_id, tipo, valor", limite: 30000, escopo: null, filtrar: (q, c) => q.eq("empresa_id", c.empresaId) },
];

/** Baixa a tabela inteira em páginas. null = erro ou maior que o limite (aí não guarda pela metade). */
async function baixarTabela(
  supabase: SupabaseBrowser,
  def: DefinicaoTabela,
  ctx: { empresaId: string; userId: string }
): Promise<LinhaRetrato[] | null> {
  const linhas: LinhaRetrato[] = [];
  for (let de = 0; de < def.limite; de += PAGINA_SUPABASE) {
    const base = supabase.from(def.nome).select(def.select) as unknown as FiltroQuery;
    const { data, error } = await def
      .filtrar(base, ctx)
      .order("id", { ascending: true })
      .range(de, de + PAGINA_SUPABASE - 1);
    if (error || !data) return null;
    linhas.push(...data);
    if (data.length < PAGINA_SUPABASE) return linhas;
  }
  return null;
}

function comDataSalva(corpo: BodyInit, tipo: string): Response {
  return new Response(corpo, {
    status: 200,
    headers: { "content-type": tipo, [HEADER_SALVO_EM]: String(Date.now()) },
  });
}

function arquivosEstaticos(html: string): string[] {
  const achados = new Set<string>();
  for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)<>]+/g)) achados.add(m[0]);
  for (const m of html.matchAll(/(?<![/\w])static\/(?:chunks|css|media)\/[^"'\\\s)<>]+/g)) {
    achados.add(`/_next/${m[0]}`);
  }
  return [...achados];
}

async function emLotes<T>(itens: T[], tarefa: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const trabalhadores = Array.from({ length: Math.min(DOWNLOADS_SIMULTANEOS, itens.length) }, async () => {
    while (i < itens.length) {
      const item = itens[i++];
      await tarefa(item).catch(() => {});
    }
  });
  await Promise.all(trabalhadores);
}

async function guardarPaginas(caminhos: string[]): Promise<number> {
  const paginas = await caches.open(CACHE_PAGINAS);
  const estaticos = await caches.open(CACHE_ESTATICOS);
  const arquivos = new Set<string>();
  let guardadas = 0;

  await emLotes(caminhos, async (caminho) => {
    const res = await fetch(caminho, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    const tipo = res.headers.get("content-type") ?? "";
    if (!res.ok || res.redirected || !tipo.includes("text/html")) return;
    const html = await res.text();
    await paginas.put(new URL(caminho, location.origin).href, comDataSalva(html, tipo));
    guardadas++;
    for (const a of arquivosEstaticos(html)) arquivos.add(a);
  });

  const faltando: string[] = [];
  for (const a of arquivos) {
    if (!(await estaticos.match(a, { ignoreVary: true }))) faltando.push(a);
  }
  await emLotes(faltando, async (arquivo) => {
    const res = await fetch(arquivo, { credentials: "same-origin" });
    const cc = res.headers.get("cache-control") ?? "";
    if (res.ok && cc.includes("immutable")) await estaticos.put(arquivo, res);
  });

  return guardadas;
}

async function guardarUsuario(supabase: SupabaseBrowser): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  const url = `${base.replace(/\/$/, "")}/auth/v1/user`;
  const res = await fetch(url, {
    headers: { apikey: anon, Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) return;
  const cache = await caches.open(CACHE_DADOS);
  await cache.put(url, comDataSalva(await res.blob(), "application/json"));
}

async function guardarKitsFuraFura(pontos: LinhaRetrato[]): Promise<void> {
  const kits = [
    ...new Set(
      pontos
        .filter((p) => p.status === "ativo" && typeof p.kit_ativo_id === "string" && p.kit_ativo_id)
        .map((p) => String(p.kit_ativo_id))
    ),
  ];
  if (kits.length === 0) return;
  const cache = await caches.open(CACHE_DADOS);
  await emLotes(kits, async (kit) => {
    const url = new URL(`/api/fura-kits/${kit}`, location.origin).href;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return;
    await cache.put(url, comDataSalva(await res.blob(), "application/json"));
  });
}

export type ResultadoPreparo =
  | { ok: true; pontos: number; paginas: number; preparadoEm: number }
  | { ok: false; motivo: string };

let emAndamento: Promise<ResultadoPreparo> | null = null;

async function executar(userId: string): Promise<ResultadoPreparo> {
  const supabase = createClient();
  const empresaId = await getEmpresaIdForUser(supabase);
  if (!empresaId) return { ok: false, motivo: "Sem empresa vinculada." };

  const ctx = { empresaId, userId };
  const agora = Date.now();
  const retratos: RetratoTabela[] = [];
  for (const def of TABELAS) {
    const linhas = await baixarTabela(supabase, def, ctx).catch(() => null);
    if (linhas) retratos.push({ nome: def.nome, linhas, escopo: def.escopo, salvo_em: agora });
  }
  if (!retratos.some((r) => r.nome === "pontos")) {
    return { ok: false, motivo: "Não foi possível baixar os pontos." };
  }
  await salvarTabelas(retratos);

  const empresa = retratos.find((r) => r.nome === "empresas")?.linhas[0] ?? null;
  const nichos = resolveNichosAtivos(
    (empresa?.nichos_ativos as Nicho[] | null | undefined) ?? null,
    (empresa?.nicho as Nicho | null | undefined) ?? null
  );
  const pontos = retratos.find((r) => r.nome === "pontos")?.linhas ?? [];

  const paginas = await guardarPaginas(paginasDoCampo(nichos)).catch(() => 0);
  await guardarUsuario(supabase).catch(() => {});
  if (nichos.includes("fura_fura")) await guardarKitsFuraFura(pontos).catch(() => {});

  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }

  await salvarMeta({
    dono: userId,
    empresa_id: empresaId,
    nome_operacao: typeof empresa?.nome_operacao === "string" ? empresa.nome_operacao : null,
    nichos,
    preparado_em: agora,
  });
  avisarCampoMudou();

  return {
    ok: true,
    pontos: pontos.filter((p) => p.status === "ativo").length,
    paginas,
    preparadoEm: agora,
  };
}

/** Baixa os dados da rota e guarda as telas de campo no celular. Uma execução por vez. */
export function prepararCampo(userId: string): Promise<ResultadoPreparo> {
  if (!campoDisponivel()) return Promise.resolve({ ok: false, motivo: "Aparelho sem suporte." });
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.resolve({ ok: false, motivo: "Sem internet." });
  }
  if (!emAndamento) {
    emAndamento = executar(userId)
      .catch((e: unknown) => ({
        ok: false as const,
        motivo: e instanceof Error ? e.message : "Erro ao preparar o modo campo.",
      }))
      .finally(() => {
        emAndamento = null;
      });
  }
  return emAndamento;
}
