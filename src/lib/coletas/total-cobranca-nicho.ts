function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Total a cobrar alinhado ao Cassino: operação + pendência (se marcada) − haver (se marcado). */
export function totalCobrancaNicho(opts: {
  valorOperacao: number;
  pendenciaSaldo?: number;
  incluirPendencia?: boolean;
  haverSaldo?: number;
  descontarHaver?: boolean;
}): {
  valorOperacao: number;
  pendenciaIncluida: number;
  haverDescontado: number;
  totalACobrar: number;
} {
  const valorOperacao = Math.max(0, opts.valorOperacao);
  const pendenciaIncluida =
    opts.incluirPendencia && (opts.pendenciaSaldo ?? 0) > 0.009
      ? round2(opts.pendenciaSaldo!)
      : 0;
  // Haver abate só o valor da operação (igual às APIs dos nichos).
  const haverDescontado =
    opts.descontarHaver && (opts.haverSaldo ?? 0) > 0.009
      ? round2(Math.min(opts.haverSaldo!, valorOperacao))
      : 0;
  const totalACobrar = round2(Math.max(0, valorOperacao - haverDescontado + pendenciaIncluida));
  return { valorOperacao, pendenciaIncluida, haverDescontado, totalACobrar };
}

/** Detalhe para comprovante (dívida/haver) — null se não há nada além da operação. */
export function detalheCobrancaParaComprovante(opts: {
  valorOperacao: number;
  pendenciaSaldo?: number;
  incluirPendencia?: boolean;
  haverSaldo?: number;
  descontarHaver?: boolean;
}): {
  totalACobrar: number;
  cobranca: {
    dividaAnterior: number;
    haverAnterior: number;
    haverAbatido: number;
    totalACobrar: number;
  } | null;
} {
  const cobranca = totalCobrancaNicho(opts);
  const haverAnterior =
    opts.descontarHaver && (opts.haverSaldo ?? 0) > 0.009
      ? round2(opts.haverSaldo!)
      : 0;
  const temExtra =
    cobranca.pendenciaIncluida > 0.009 || cobranca.haverDescontado > 0.009;
  return {
    totalACobrar: cobranca.totalACobrar,
    cobranca: temExtra
      ? {
          dividaAnterior: cobranca.pendenciaIncluida,
          haverAnterior,
          haverAbatido: cobranca.haverDescontado,
          totalACobrar: cobranca.totalACobrar,
        }
      : null,
  };
}
