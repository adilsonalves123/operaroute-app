import {
  totaisComprovanteVisita,
  valorNichoComprovante,
} from "@/lib/visitas-ponto/comprovante-totais";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Snapshot do comprovante a partir do resumo já carregado na UI (cliente ou servidor). */
export function snapshotFromVisitaPonto(
  resumo: VisitaPontoResumo,
  opts: {
    previa?: boolean;
    dividaSaldo?: number;
    desconto?: number;
    pix?: number;
    dinheiro?: number;
    haverSaldo?: number;
    descontarHaver?: boolean;
    nomeOperacao?: string | null;
    chavePix?: string | null;
  }
): ComprovanteSnapshot {
  const totais = totaisComprovanteVisita(resumo, {
    dividaSaldo: opts.dividaSaldo ?? 0,
    desconto: opts.desconto,
    pix: opts.pix,
    dinheiro: opts.dinheiro,
    haverSaldo: opts.haverSaldo,
    descontarHaver: opts.descontarHaver,
  });

  const notas: string[] = [];
  if (resumo.cassinoNegativo) {
    notas.push(
      `Cassino negativo (fora da cobrança): operação ${round2(resumo.cassinoNegativo.valorOperacao).toFixed(2)}`
    );
  }

  const maquinas = resumo.nichos.flatMap((n) =>
    n.maquinas.map((m) => ({
      nome: m.nome,
      lucro: n.nicho === "cassino" ? m.lucro : m.valorCobravel,
      ...(m.entradaAtual != null ? { entradaAtual: m.entradaAtual } : {}),
      ...(m.saidaAtual != null ? { saidaAtual: m.saidaAtual } : {}),
    }))
  );

  const cassino = resumo.nichos.find((n) => n.nicho === "cassino");
  const valorOperacional =
    cassino?.valorOperacao != null && cassino.valorOperacao > 0.009
      ? round2(cassino.valorOperacao)
      : cassino
        ? round2(cassino.totalLucro)
        : undefined;
  const comissao =
    cassino?.valorCliente != null ? round2(cassino.valorCliente) : undefined;
  const haverAbatido = round2(totais.haverAbatido);
  const haverAnterior = round2(opts.haverSaldo ?? 0);
  const haverRestante = round2(Math.max(0, haverAnterior - haverAbatido));
  const totalBruto = round2(
    haverAbatido > 0.009
      ? totais.totalACobrar + haverAbatido
      : totais.totalACobrar
  );

  return {
    empresaNome: (opts.nomeOperacao ?? "").trim() || "Operação",
    chavePix: opts.chavePix?.trim() || null,
    pontoNome: resumo.pontoNome,
    dataIso: resumo.finalizadaEm ?? resumo.createdAt,
    previa: opts.previa === true,
    nichos: resumo.nichos.map((n) => ({
      label: n.label,
      valor: valorNichoComprovante(n),
    })),
    maquinas: maquinas.length > 0 ? maquinas : undefined,
    valorOperacional,
    comissao,
    subtotal: totais.subtotal,
    divida: totais.dividaSaldo,
    desconto: totais.desconto,
    haverAbatido,
    totalACobrar: totais.totalACobrar,
    valorPago: totais.valorPago,
    restante: totais.restante,
    haverGerado: totais.haverGerado,
    haverRestante,
    haverAnterior,
    totalBruto,
    notas: notas.length ? notas : undefined,
  };
}
