import type { ChamadoPrioridade, ChamadoStatus } from "@/lib/chamados/types";

export type ChamadoResumoPonto = {
  id: string;
  ponto_id: string;
  equipamento_id: string | null;
  titulo: string;
  status: ChamadoStatus;
  prioridade: ChamadoPrioridade;
  equipamentos?: { nome: string } | null;
};

export type ChamadosResumoEmpresa = {
  total: number;
  porPonto: Map<string, ChamadoResumoPonto[]>;
  lista: ChamadoResumoPonto[];
};

type ChamadoRowDb = {
  id: string;
  ponto_id: string;
  equipamento_id: string | null;
  titulo: string;
  status: string;
  prioridade: string;
  equipamentos?: { nome: string } | null;
};

export function agruparChamadosPorPonto(
  rows: ChamadoRowDb[]
): ChamadosResumoEmpresa {
  const porPonto = new Map<string, ChamadoResumoPonto[]>();
  const lista: ChamadoResumoPonto[] = [];

  for (const row of rows) {
    const item: ChamadoResumoPonto = {
      id: row.id,
      ponto_id: row.ponto_id,
      equipamento_id: row.equipamento_id,
      titulo: row.titulo,
      status: row.status as ChamadoStatus,
      prioridade: row.prioridade as ChamadoPrioridade,
      equipamentos: row.equipamentos ?? null,
    };
    lista.push(item);
    const arr = porPonto.get(row.ponto_id) ?? [];
    arr.push(item);
    porPonto.set(row.ponto_id, arr);
  }

  return { total: lista.length, porPonto, lista };
}

/** Prioridade extra na rota quando há manutenção aberta */
export function scoreChamadoRota(chamados: ChamadoResumoPonto[]): number {
  if (chamados.length === 0) return 0;
  const temUrgente = chamados.some((c) => c.prioridade === "urgente" || c.prioridade === "alta");
  return temUrgente ? -15 : -8;
}
