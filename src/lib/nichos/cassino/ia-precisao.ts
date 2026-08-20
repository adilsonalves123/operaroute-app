export type AiReadingRow = {
  id: string;
  equipamento_id: string | null;
  score: number | null;
  confidence: number | null;
  status: string;
  final_status: string | null;
  flags: string[] | null;
  entrada_sugerida: number | null;
  saida_sugerida: number | null;
  entrada_final: number | null;
  saida_final: number | null;
  excecao_contador: string | null;
  correcao_humana: Record<string, unknown> | null;
  created_at: string;
  finalized_at: string | null;
};

export type IaPrecisaoResumo = {
  total: number;
  finalizadas: number;
  aprovadasIa: number;
  corrigidasManual: number;
  rejeitadas: number;
  pendentes: number;
  taxaAcertoIa: number | null;
  taxaCorrecaoManual: number | null;
  scoreMedio: number | null;
  confiancaMedia: number | null;
  comExcecaoContador: number;
  comManutencaoDetectada: number;
  flagsFrequentes: { flag: string; count: number }[];
  porDia: { dia: string; total: number; acertoIa: number; correcao: number }[];
};

function parseFlags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function centesimosIguais(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.round(a) === Math.round(b);
}

function diaIso(iso: string): string {
  return iso.slice(0, 10);
}

export function calcularPrecisaoIa(rows: AiReadingRow[]): IaPrecisaoResumo {
  const finalizadas = rows.filter((r) => r.final_status != null);
  const aprovadasIa = finalizadas.filter((r) => r.final_status === "approved_ai");
  const corrigidasManual = finalizadas.filter((r) => r.final_status === "approved_manual");
  const rejeitadas = rows.filter((r) => r.final_status === "rejected" || r.status === "rejected");
  const pendentes = rows.filter((r) => !r.final_status && r.status !== "rejected" && r.status !== "error");

  const acertosExatos = finalizadas.filter(
    (r) =>
      r.final_status === "approved_ai" &&
      centesimosIguais(r.entrada_sugerida, r.entrada_final) &&
      centesimosIguais(r.saida_sugerida, r.saida_final)
  );

  const scores = finalizadas.map((r) => r.score).filter((n): n is number => n != null);
  const confs = finalizadas.map((r) => r.confidence).filter((n): n is number => n != null);

  const flagCounts = new Map<string, number>();
  for (const row of rows) {
    for (const flag of parseFlags(row.flags)) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  const porDiaMap = new Map<string, { total: number; acertoIa: number; correcao: number }>();
  for (const row of finalizadas) {
    const dia = diaIso(row.finalized_at ?? row.created_at);
    const cur = porDiaMap.get(dia) ?? { total: 0, acertoIa: 0, correcao: 0 };
    cur.total += 1;
    if (row.final_status === "approved_ai") cur.acertoIa += 1;
    if (row.final_status === "approved_manual") cur.correcao += 1;
    porDiaMap.set(dia, cur);
  }

  const comExcecao = rows.filter((r) => Boolean(r.excecao_contador)).length;
  const comManutencao = rows.filter((r) =>
    parseFlags(r.flags).includes("manutencao_recente_detectada")
  ).length;

  const taxaBase = finalizadas.length > 0 ? finalizadas.length : null;

  return {
    total: rows.length,
    finalizadas: finalizadas.length,
    aprovadasIa: aprovadasIa.length,
    corrigidasManual: corrigidasManual.length,
    rejeitadas: rejeitadas.length,
    pendentes: pendentes.length,
    taxaAcertoIa:
      taxaBase != null ? Math.round((acertosExatos.length / taxaBase) * 1000) / 10 : null,
    taxaCorrecaoManual:
      taxaBase != null ? Math.round((corrigidasManual.length / taxaBase) * 1000) / 10 : null,
    scoreMedio:
      scores.length > 0
        ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
        : null,
    confiancaMedia:
      confs.length > 0
        ? Math.round((confs.reduce((s, n) => s + n, 0) / confs.length) * 1000) / 10
        : null,
    comExcecaoContador: comExcecao,
    comManutencaoDetectada: comManutencao,
    flagsFrequentes: Array.from(flagCounts.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    porDia: Array.from(porDiaMap.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .slice(-14),
  };
}
