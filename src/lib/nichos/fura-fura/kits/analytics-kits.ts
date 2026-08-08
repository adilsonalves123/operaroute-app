import type { RankingKitFuros, PontoKitAlertaBrinde } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ColetaKitRow = {
  ponto_id: string;
  kit_id: string | null;
  kit_nome: string | null;
  quantidade_furos: number | null;
  brindes_entregues: unknown;
  pontos?: { nome: string } | { nome: string }[] | null;
};

function totalBrindesEntregues(brindes: unknown): number {
  if (!Array.isArray(brindes)) return 0;
  return brindes.reduce((s, b) => s + Math.max(0, Number((b as { quantidade?: number }).quantidade) || 0), 0);
}

/** Ranking principal: qual kit atrai mais furos. */
export function rankingKitsPorFuros(coletas: ColetaKitRow[]): RankingKitFuros[] {
  const map = new Map<
    string,
    { kitNome: string; furos: number; coletas: number; brindes: number }
  >();

  for (const c of coletas) {
    if (!c.kit_id) continue;
    const furos = Math.max(0, Number(c.quantidade_furos) || 0);
    const brindes = totalBrindesEntregues(c.brindes_entregues);
    const prev = map.get(c.kit_id) ?? {
      kitNome: c.kit_nome ?? "Kit",
      furos: 0,
      coletas: 0,
      brindes: 0,
    };
    prev.furos += furos;
    prev.coletas += 1;
    prev.brindes += brindes;
    if (c.kit_nome) prev.kitNome = c.kit_nome;
    map.set(c.kit_id, prev);
  }

  return [...map.entries()]
    .map(([kitId, v]) => ({
      kitId,
      kitNome: v.kitNome,
      totalFuros: v.furos,
      totalColetas: v.coletas,
      mediaFurosPorColeta: v.coletas > 0 ? round2(v.furos / v.coletas) : 0,
      totalBrindes: v.brindes,
      ratioBrindesPorFuro: v.furos > 0 ? round2(v.brindes / v.furos) : null,
    }))
    .sort((a, b) => b.totalFuros - a.totalFuros);
}

/** Pontos com saída de brindes acima do normal para o kit (possível furador mal montado). */
export function alertasBrindeAnormal(
  coletas: ColetaKitRow[],
  desvioMinimoPct = 50
): PontoKitAlertaBrinde[] {
  const ranking = rankingKitsPorFuros(coletas);
  const ratioMedioPorKit = new Map<string, number>();
  for (const k of ranking) {
    if (k.ratioBrindesPorFuro != null) {
      ratioMedioPorKit.set(k.kitId, k.ratioBrindesPorFuro);
    }
  }

  const porPonto = new Map<
    string,
    { nome: string; kitId: string | null; kitNome: string | null; furos: number; brindes: number }
  >();

  for (const c of coletas) {
    if (!c.kit_id) continue;
    const ponto = Array.isArray(c.pontos) ? c.pontos[0] : c.pontos;
    const prev = porPonto.get(c.ponto_id) ?? {
      nome: ponto?.nome ?? "Ponto",
      kitId: c.kit_id,
      kitNome: c.kit_nome,
      furos: 0,
      brindes: 0,
    };
    prev.furos += Math.max(0, Number(c.quantidade_furos) || 0);
    prev.brindes += totalBrindesEntregues(c.brindes_entregues);
    porPonto.set(c.ponto_id, prev);
  }

  const alertas: PontoKitAlertaBrinde[] = [];

  for (const [pontoId, p] of porPonto) {
    if (!p.kitId || p.furos < 5) continue;
    const ratioAtual = round2(p.brindes / p.furos);
    const ratioMedio = ratioMedioPorKit.get(p.kitId);
    if (ratioMedio == null || ratioMedio <= 0.001) continue;
    const desvioPct = round2(((ratioAtual - ratioMedio) / ratioMedio) * 100);
    if (desvioPct >= desvioMinimoPct && p.brindes >= 2) {
      alertas.push({
        pontoId,
        pontoNome: p.nome,
        kitId: p.kitId,
        kitNome: p.kitNome,
        ratioAtual,
        ratioMedioKit: ratioMedio,
        desvioPct,
      });
    }
  }

  return alertas.sort((a, b) => b.desvioPct - a.desvioPct);
}
