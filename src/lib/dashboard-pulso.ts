/** Evento normalizado para calcular impulsos e pressões nos pontos. */
export type PulsoEvento = {
  created_at: string;
  lucroReais: number;
  negativa: boolean;
};

export type PulsoPeriodo = {
  impulsos: number;
  pressoes: number;
  neutros: number;
  /** 0–100 quando há impulsos ou pressões; null se sem dados */
  indice: number | null;
};

export type PulsoOperacao = {
  semana: PulsoPeriodo;
  mes: PulsoPeriodo;
  semanaAnterior: PulsoPeriodo;
  /** Diferença em pontos percentuais vs semana passada */
  deltaSemanaPontos: number | null;
  totalEventos: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function classificarEvento(e: PulsoEvento): "impulso" | "pressao" | "neutro" {
  if (e.negativa || e.lucroReais < -0.009) return "pressao";
  if (e.lucroReais > 0.009) return "impulso";
  return "neutro";
}

function agregarPeriodo(eventos: PulsoEvento[]): PulsoPeriodo {
  let impulsos = 0;
  let pressoes = 0;
  let neutros = 0;

  for (const e of eventos) {
    const tipo = classificarEvento(e);
    if (tipo === "impulso") impulsos++;
    else if (tipo === "pressao") pressoes++;
    else neutros++;
  }

  const total = impulsos + pressoes;
  const indice = total > 0 ? Math.round((impulsos / total) * 1000) / 10 : null;

  return { impulsos, pressoes, neutros, indice };
}

function filtrarEntre(eventos: PulsoEvento[], inicio: Date, fim: Date): PulsoEvento[] {
  const t0 = inicio.getTime();
  const t1 = fim.getTime();
  return eventos.filter((e) => {
    const t = new Date(e.created_at).getTime();
    return t >= t0 && t <= t1;
  });
}

export function computePulsoOperacao(eventos: PulsoEvento[]): PulsoOperacao {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(inicioSemana.getDate() - 6);
  const inicioSemanaAnterior = new Date(hoje);
  inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 13);
  const fimSemanaAnterior = new Date(hoje);
  fimSemanaAnterior.setDate(fimSemanaAnterior.getDate() - 7);
  fimSemanaAnterior.setHours(23, 59, 59, 999);
  const inicioMes = startOfMonth(agora);

  const semana = agregarPeriodo(filtrarEntre(eventos, inicioSemana, agora));
  const mes = agregarPeriodo(filtrarEntre(eventos, inicioMes, agora));
  const semanaAnterior = agregarPeriodo(
    filtrarEntre(eventos, inicioSemanaAnterior, fimSemanaAnterior)
  );

  let deltaSemanaPontos: number | null = null;
  if (semana.indice !== null && semanaAnterior.indice !== null) {
    deltaSemanaPontos = Math.round((semana.indice - semanaAnterior.indice) * 10) / 10;
  }

  return {
    semana,
    mes,
    semanaAnterior,
    deltaSemanaPontos,
    totalEventos: eventos.length,
  };
}

export function mensagemPulso(pulso: PulsoOperacao): string {
  const idx = pulso.semana.indice ?? pulso.mes.indice;
  if (idx === null) return "Registre coletas para acompanhar o pulso da operação.";
  if (idx >= 85) return "Seus pontos estão em forte tração — maioria das visitas positivas.";
  if (idx >= 65) return "Operação saudável — mais impulso que pressão nos pontos.";
  if (idx >= 45) return "Equilíbrio apertado — vale reforçar os pontos com pressão.";
  return "Semana exigente — vários pontos com prejuízo; priorize recuperação.";
}
