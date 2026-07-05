import { extrairTotalAbatido } from "@/lib/nichos/cassino/pendencias";

const PIX_REGEX = /Pix R\$ ([\d.,]+)/i;
const DINHEIRO_REGEX = /Dinheiro R\$ ([\d.,]+)/i;

function parseBRL(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

export type VisitaFinanceiro = {
  valor_pix: number | null;
  valor_dinheiro: number | null;
  debito_abatido: number | null;
  desconto: number | null;
  desconto_recebimento: number | null;
} | null;

export type LancamentoBreakdown = {
  pix: number;
  dinheiro: number;
  debitoAbatido: number;
  descontoManual: number;
  descontoRecebimento: number;
  descontoTotal: number;
};

export type DescontoTotais = {
  manual: number;
  recebimento: number;
  total: number;
};

export function descontoFromVisita(visita: VisitaFinanceiro): DescontoTotais {
  if (!visita) return { manual: 0, recebimento: 0, total: 0 };
  const manual = Number(visita.desconto ?? 0);
  const recebimento = Number(visita.desconto_recebimento ?? 0);
  return { manual, recebimento, total: manual + recebimento };
}

export function somarDescontos(
  visitas: { desconto: number | null; desconto_recebimento: number | null }[]
): DescontoTotais {
  return visitas.reduce(
    (acc, v) => {
      const manual = Number(v.desconto ?? 0);
      const recebimento = Number(v.desconto_recebimento ?? 0);
      return {
        manual: acc.manual + manual,
        recebimento: acc.recebimento + recebimento,
        total: acc.total + manual + recebimento,
      };
    },
    { manual: 0, recebimento: 0, total: 0 }
  );
}

export function breakdownLancamento(l: {
  tipo: string;
  valor: number;
  forma_pagamento: string | null;
  descricao: string | null;
  visitas?: VisitaFinanceiro;
}): LancamentoBreakdown {
  const valor = Number(l.valor ?? 0);
  const visita = l.visitas;

  if (visita) {
    const descontos = descontoFromVisita(visita);
    return {
      pix: Number(visita.valor_pix ?? 0),
      dinheiro: Number(visita.valor_dinheiro ?? 0),
      debitoAbatido: Number(visita.debito_abatido ?? 0),
      descontoManual: descontos.manual,
      descontoRecebimento: descontos.recebimento,
      descontoTotal: descontos.total,
    };
  }

  const pixMatch = l.descricao?.match(PIX_REGEX);
  const dinheiroMatch = l.descricao?.match(DINHEIRO_REGEX);
  if (pixMatch || dinheiroMatch) {
    return {
      pix: pixMatch ? parseBRL(pixMatch[1]) : 0,
      dinheiro: dinheiroMatch ? parseBRL(dinheiroMatch[1]) : 0,
      debitoAbatido: 0,
      descontoManual: 0,
      descontoRecebimento: 0,
      descontoTotal: 0,
    };
  }

  if (l.tipo !== "entrada" && l.tipo !== "saida") {
    return {
      pix: 0,
      dinheiro: 0,
      debitoAbatido: 0,
      descontoManual: 0,
      descontoRecebimento: 0,
      descontoTotal: 0,
    };
  }

  const forma = l.forma_pagamento;
  if (forma === "pix") {
    return {
      pix: valor,
      dinheiro: 0,
      debitoAbatido: 0,
      descontoManual: 0,
      descontoRecebimento: 0,
      descontoTotal: 0,
    };
  }
  if (forma === "dinheiro") {
    return {
      pix: 0,
      dinheiro: valor,
      debitoAbatido: 0,
      descontoManual: 0,
      descontoRecebimento: 0,
      descontoTotal: 0,
    };
  }

  return {
    pix: 0,
    dinheiro: 0,
    debitoAbatido: 0,
    descontoManual: 0,
    descontoRecebimento: 0,
    descontoTotal: 0,
  };
}

export function totalDividasAbatidas(
  pendencias: { descricao: string | null }[] | null | undefined
): number {
  return pendencias?.reduce((s, p) => s + extrairTotalAbatido(p.descricao), 0) ?? 0;
}

export function formaPagamentoLabel(forma: string | null | undefined): string | null {
  if (!forma) return null;
  const labels: Record<string, string> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    misto: "Pix + dinheiro",
  };
  return labels[forma] ?? forma;
}
