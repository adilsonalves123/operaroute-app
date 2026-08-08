import type { SupabaseClient } from "@supabase/supabase-js";

/** Padrão quando a empresa ainda não configurou. */
export const RETENCAO_MIDIA_COLETA_DIAS = 90;

/** Opções da UI / API. 0 = nunca apagar automaticamente. */
export const RETENCAO_MIDIA_OPCOES = [
  { value: 30, label: "A cada 30 dias" },
  { value: 60, label: "A cada 60 dias" },
  { value: 90, label: "A cada 90 dias (recomendado)" },
  { value: 180, label: "A cada 180 dias" },
  { value: 0, label: "Nunca (só apagar na mão)" },
] as const;

export type RetencaoMidiaDias = (typeof RETENCAO_MIDIA_OPCOES)[number]["value"];

export function normalizarRetencaoMidiaDias(raw: unknown): RetencaoMidiaDias {
  const n = Number(raw);
  if (n === 0 || n === 30 || n === 60 || n === 90 || n === 180) return n;
  return RETENCAO_MIDIA_COLETA_DIAS;
}

export function labelRetencaoMidia(dias: number): string {
  const op = RETENCAO_MIDIA_OPCOES.find((o) => o.value === dias);
  return op?.label ?? `${dias} dias`;
}

const BUCKET = "coleta-fotos";
const BATCH = 80;

/** Extrai path no bucket a partir da URL pública do Storage. */
export function pathFromColetaFotoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
    }
    const alt = `/storage/v1/object/public/${BUCKET}/`;
    const idx2 = url.indexOf(alt);
    if (idx2 >= 0) {
      return decodeURIComponent(url.slice(idx2 + alt.length).split("?")[0]);
    }
  } catch {
    return null;
  }
  return null;
}

/** Só apaga mídia de coleta/relatório — nunca estoque, ponto, equipamento, kit. */
export function isPathMidiaColetaTemporaria(path: string): boolean {
  const parts = path.split("/");
  if (parts.length < 2) return false;
  const kind = parts[1];
  return kind === "relatorios" || kind === "fotos_coleta" || kind === "fotos_fura";
}

export type LimpezaMidiaResultado = {
  dias: number;
  relatoriosRemovidos: number;
  fotosColetaLimpas: number;
  arquivosStorage: number;
  erros: string[];
  pulou?: boolean;
};

function cutoffIso(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString();
}

async function removerArquivos(
  supabase: SupabaseClient,
  paths: string[]
): Promise<number> {
  const validos = [
    ...new Set(paths.filter((p) => p && isPathMidiaColetaTemporaria(p))),
  ];
  if (!validos.length) return 0;

  let removidos = 0;
  for (let i = 0; i < validos.length; i += 50) {
    const chunk = validos.slice(i, i + 50);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (!error) removidos += chunk.length;
  }
  return removidos;
}

/** Remove um arquivo de mídia de coleta pelo URL (exclusão manual). */
export async function removerArquivoPorUrl(
  supabase: SupabaseClient,
  url: string | null | undefined
): Promise<boolean> {
  const path = pathFromColetaFotoUrl(url);
  if (!path || !isPathMidiaColetaTemporaria(path)) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return !error;
}

/**
 * Remove mídia antiga de uma empresa.
 * dias = 0 → não faz nada (só exclusão manual).
 */
export async function limparMidiaAntigaEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
  dias: number = RETENCAO_MIDIA_COLETA_DIAS
): Promise<LimpezaMidiaResultado> {
  const diasNorm = normalizarRetencaoMidiaDias(dias);
  const vazio: LimpezaMidiaResultado = {
    dias: diasNorm,
    relatoriosRemovidos: 0,
    fotosColetaLimpas: 0,
    arquivosStorage: 0,
    erros: [],
  };

  if (diasNorm === 0) {
    return { ...vazio, pulou: true };
  }

  const erros: string[] = [];
  const corte = cutoffIso(diasNorm);
  let relatoriosRemovidos = 0;
  let fotosColetaLimpas = 0;
  let arquivosStorage = 0;

  const { data: rels, error: errRel } = await supabase
    .from("relatorios_coleta")
    .select("id, foto_url, visita_id")
    .eq("empresa_id", empresaId)
    .lt("created_at", corte)
    .limit(BATCH);

  if (errRel) {
    erros.push(`relatorios_coleta: ${errRel.message}`);
  } else if (rels?.length) {
    const paths = rels.map((r) => pathFromColetaFotoUrl(r.foto_url)).filter(Boolean) as string[];
    arquivosStorage += await removerArquivos(supabase, paths);

    const visitaIds = [
      ...new Set(rels.map((r) => r.visita_id).filter(Boolean) as string[]),
    ];
    if (visitaIds.length) {
      const { error: errVis } = await supabase
        .from("visitas")
        .update({ relatorio_url: null })
        .eq("empresa_id", empresaId)
        .in("id", visitaIds)
        .lt("created_at", corte);
      if (errVis) erros.push(`visitas.relatorio_url: ${errVis.message}`);
    }

    const ids = rels.map((r) => r.id);
    const { error: errDel } = await supabase
      .from("relatorios_coleta")
      .delete()
      .in("id", ids);
    if (errDel) erros.push(`delete relatorios: ${errDel.message}`);
    else relatoriosRemovidos = ids.length;
  }

  const { data: coletas, error: errCol } = await supabase
    .from("coletas")
    .select("id, foto_url")
    .eq("empresa_id", empresaId)
    .not("foto_url", "is", null)
    .lt("created_at", corte)
    .limit(BATCH);

  if (errCol) {
    erros.push(`coletas: ${errCol.message}`);
  } else if (coletas?.length) {
    const paths = coletas
      .map((c) => pathFromColetaFotoUrl(c.foto_url))
      .filter(Boolean) as string[];
    arquivosStorage += await removerArquivos(supabase, paths);

    const ids = coletas.map((c) => c.id);
    const { error: errUp } = await supabase
      .from("coletas")
      .update({ foto_url: null })
      .in("id", ids);
    if (errUp) erros.push(`coletas.foto_url: ${errUp.message}`);
    else fotosColetaLimpas = ids.length;
  }

  const { data: visitas, error: errV2 } = await supabase
    .from("visitas")
    .select("id, relatorio_url")
    .eq("empresa_id", empresaId)
    .not("relatorio_url", "is", null)
    .lt("created_at", corte)
    .limit(BATCH);

  if (errV2) {
    erros.push(`visitas: ${errV2.message}`);
  } else if (visitas?.length) {
    const paths = visitas
      .map((v) => pathFromColetaFotoUrl(v.relatorio_url))
      .filter(Boolean) as string[];
    arquivosStorage += await removerArquivos(supabase, paths);
    const { error: errClr } = await supabase
      .from("visitas")
      .update({ relatorio_url: null })
      .in(
        "id",
        visitas.map((v) => v.id)
      );
    if (errClr) erros.push(`limpar visitas: ${errClr.message}`);
  }

  return {
    dias: diasNorm,
    relatoriosRemovidos,
    fotosColetaLimpas,
    arquivosStorage,
    erros,
  };
}

/**
 * Cron global: usa retencao_midia_dias de cada empresa.
 */
export async function limparMidiaAntigaTodasEmpresas(
  admin: SupabaseClient,
  opts?: { maxEmpresas?: number }
): Promise<{ empresas: number; total: LimpezaMidiaResultado }> {
  const maxEmpresas = opts?.maxEmpresas ?? 40;

  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, retencao_midia_dias")
    .limit(maxEmpresas);

  if (error) {
    return {
      empresas: 0,
      total: {
        dias: RETENCAO_MIDIA_COLETA_DIAS,
        relatoriosRemovidos: 0,
        fotosColetaLimpas: 0,
        arquivosStorage: 0,
        erros: [error.message],
      },
    };
  }

  const total: LimpezaMidiaResultado = {
    dias: RETENCAO_MIDIA_COLETA_DIAS,
    relatoriosRemovidos: 0,
    fotosColetaLimpas: 0,
    arquivosStorage: 0,
    erros: [],
  };

  for (const emp of empresas ?? []) {
    const dias = normalizarRetencaoMidiaDias(emp.retencao_midia_dias);
    if (dias === 0) continue;
    const r = await limparMidiaAntigaEmpresa(admin, emp.id, dias);
    total.relatoriosRemovidos += r.relatoriosRemovidos;
    total.fotosColetaLimpas += r.fotosColetaLimpas;
    total.arquivosStorage += r.arquivosStorage;
    total.erros.push(...r.erros.map((e) => `${emp.id}: ${e}`));
  }

  return { empresas: (empresas ?? []).length, total };
}
