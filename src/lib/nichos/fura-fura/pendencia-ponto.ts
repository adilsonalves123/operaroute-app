import { saldoPendenteColeta } from "./pagamentos-fifo";

export type ResumoPendenciaPonto = {
  totalPendente: number;
  coletasAbertas: number;
};

export type ColetaSaldoPonto = {
  ponto_id: string | null;
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Agrega saldo em aberto por ponto (coletas não quitadas). */
export function agregarPendenciasPorPonto(
  coletas: ColetaSaldoPonto[]
): Map<string, ResumoPendenciaPonto> {
  const map = new Map<string, ResumoPendenciaPonto>();

  for (const c of coletas) {
    const saldo = saldoPendenteColeta(c);
    if (saldo <= 0.009 || !c.ponto_id) continue;

    const prev = map.get(c.ponto_id) ?? { totalPendente: 0, coletasAbertas: 0 };
    map.set(c.ponto_id, {
      totalPendente: round2(prev.totalPendente + saldo),
      coletasAbertas: prev.coletasAbertas + 1,
    });
  }

  return map;
}

export function labelPontoComPendencia(
  nome: string,
  pendencia: ResumoPendenciaPonto | undefined,
  formatCurrency: (n: number) => string
): string {
  if (!pendencia || pendencia.totalPendente <= 0.009) return nome;
  return `${nome} — deve ${formatCurrency(pendencia.totalPendente)}`;
}

export function isHaverFuraFura(p: {
  tipo?: string | null;
  titulo?: string | null;
}): boolean {
  if ((p.tipo ?? "").toLowerCase() !== "haver") return false;
  const titulo = (p.titulo ?? "").toLowerCase();
  return titulo.includes("fura-fura") || titulo.includes("fura fura");
}

/** Soma haver em aberto (crédito do ponto) do nicho fura-fura. */
export function somarHaverFuraFuraAberto(
  pendencias: { tipo?: string | null; titulo?: string | null; valor?: number | null }[]
): number {
  let total = 0;
  for (const p of pendencias) {
    if (!isHaverFuraFura(p)) continue;
    const v = Number(p.valor ?? 0);
    if (v > 0.009) total += v;
  }
  return round2(total);
}
