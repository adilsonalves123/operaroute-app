import { absoluteUrl } from "@/lib/app-url";
import { formatCurrency } from "@/lib/utils";

export type ComprovanteNichoSnap = {
  label: string;
  valor: number;
};

export type ComprovanteMaquinaSnap = {
  nome: string;
  lucro: number;
  entradaAtual?: number;
  saidaAtual?: number;
};

/**
 * Ocasião do comprovante — define narrativa e rótulos.
 * Mantém o mesmo layout visual; só muda o que é enfatizado.
 */
export type ComprovanteOcasiao =
  | "visita_negativa"
  | "recupera_negativo"
  | "quitado_haver"
  | "misto_haver"
  | "cobranca";

/** Payload estável mostrado na página pública /c/[token]. */
export type ComprovanteSnapshot = {
  empresaNome: string;
  chavePix: string | null;
  pontoNome: string;
  dataIso: string;
  previa: boolean;
  nichos: ComprovanteNichoSnap[];
  maquinas?: ComprovanteMaquinaSnap[];
  valorOperacional?: number;
  comissao?: number;
  comissaoPercentual?: number;
  subtotal: number;
  divida: number;
  desconto: number;
  haverAbatido: number;
  totalACobrar: number;
  valorPago: number;
  restante: number;
  haverGerado: number;
  haverRestante?: number;
  haverAnterior?: number;
  totalBruto?: number;
  saldoNegativo?: boolean;
  prejuizo?: number;
  valorDeixado?: number;
  /** Negativo/adiantamento em aberto antes desta visita. */
  negativoAnterior?: number;
  /** Quanto do negativo foi recuperado nesta visita (lucro ou pagamento). */
  negativoRecuperado?: number;
  /** Negativo que ainda fica para a próxima. */
  negativoRestante?: number;
  notas?: string[];
  /**
   * `relatorio` = card PNG legado (Relatorio*View estreito).
   * `historico` = layout detalhado da tela de histórico (RESULTADO + itens + fotos).
   * `comprovante` (padrão) = layout pós-finalizar compacto.
   */
  layout?: "relatorio" | "historico" | "comprovante";
  /** Nicho do relatório embutido (só layout relatorio/historico). */
  nichoModulo?:
    | "cassino"
    | "fura_fura"
    | "ursinho"
    | "diversao"
    | "bolinha"
    | "consignado"
    | "visita_ponto";
  /** Payload completo do Relatorio*Data ou histórico (JSON). */
  relatorio?: Record<string, unknown>;
};

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Inferência estável da ocasião a partir do snapshot. */
export function resolverOcasiaoComprovante(
  s: ComprovanteSnapshot
): ComprovanteOcasiao {
  if (s.saldoNegativo === true) return "visita_negativa";

  const negativoAnt = s.negativoAnterior ?? 0;
  const negativoRec = s.negativoRecuperado ?? 0;
  const negativoRest = s.negativoRestante ?? 0;
  const temHistoriaNegativo =
    negativoAnt > 0.009 || negativoRec > 0.009 || negativoRest > 0.009;

  if (temHistoriaNegativo) return "recupera_negativo";

  const haverAbatido = s.haverAbatido ?? 0;
  const pago = s.valorPago ?? 0;
  const liquido = s.totalACobrar ?? 0;

  if (haverAbatido > 0.009 && liquido <= 0.009 && pago <= 0.009) {
    return "quitado_haver";
  }
  if (haverAbatido > 0.009 && pago > 0.009) return "misto_haver";
  if (haverAbatido > 0.009) return "misto_haver";

  return "cobranca";
}

export function comprovantePublicUrl(token: string): string {
  return absoluteUrl(`/c/${token}`);
}

/** Mensagem curta pro WhatsApp — o detalhe fica no link. */
export function mensagemWhatsAppComLink(opts: {
  pontoNome: string;
  previa?: boolean;
  valorPago?: number;
  restante?: number;
  totalACobrar?: number;
  url: string;
  chavePix?: string | null;
  saldoNegativo?: boolean;
  prejuizo?: number;
  haverAbatido?: number;
  haverRestante?: number;
  haverAnterior?: number;
  totalBruto?: number;
  negativoAnterior?: number;
  negativoRecuperado?: number;
  negativoRestante?: number;
}): string {
  const snap: ComprovanteSnapshot = {
    empresaNome: "",
    chavePix: opts.chavePix ?? null,
    pontoNome: opts.pontoNome,
    dataIso: new Date().toISOString(),
    previa: opts.previa === true,
    nichos: [],
    subtotal: opts.totalACobrar ?? 0,
    divida: 0,
    desconto: 0,
    haverAbatido: opts.haverAbatido ?? 0,
    totalACobrar: opts.totalACobrar ?? 0,
    valorPago: opts.valorPago ?? 0,
    restante: opts.restante ?? 0,
    haverGerado: 0,
    haverRestante: opts.haverRestante,
    haverAnterior: opts.haverAnterior,
    totalBruto: opts.totalBruto,
    saldoNegativo: opts.saldoNegativo,
    prejuizo: opts.prejuizo,
    negativoAnterior: opts.negativoAnterior,
    negativoRecuperado: opts.negativoRecuperado,
    negativoRestante: opts.negativoRestante,
  };

  const ocasiao = resolverOcasiaoComprovante(snap);
  const linhas: string[] = [];
  linhas.push(
    opts.previa
      ? `📋 *Prévia — ${opts.pontoNome}*`
      : `📋 *Comprovante — ${opts.pontoNome}*`
  );

  const pago = opts.valorPago ?? 0;
  const restante = opts.restante ?? 0;
  const haverAbatido = opts.haverAbatido ?? 0;
  const totalBruto =
    opts.totalBruto ??
    roundMoney((opts.totalACobrar ?? 0) + haverAbatido);
  const totalPago = roundMoney(pago + haverAbatido);

  if (ocasiao === "visita_negativa") {
    const prejuizo = opts.prejuizo ?? 0;
    linhas.push(
      prejuizo > 0.009
        ? `⚠️ Negativo da visita: ${formatCurrency(prejuizo)}`
        : "⚠️ Operação negativa"
    );
  } else if (ocasiao === "recupera_negativo") {
    const ant = opts.negativoAnterior ?? 0;
    const rec = opts.negativoRecuperado ?? 0;
    const restNeg = opts.negativoRestante ?? restante;
    if (ant > 0.009) {
      linhas.push(`Negativo anterior: ${formatCurrency(ant)}`);
    }
    if (rec > 0.009) {
      linhas.push(`Recuperado agora: ${formatCurrency(rec)}`);
    }
    if (restNeg > 0.009) {
      linhas.push(`⏳ Negativo restante: ${formatCurrency(restNeg)}`);
    } else {
      linhas.push("✅ Negativo quitado");
    }
    if (pago > 0.009) {
      linhas.push(`Pago nesta visita: ${formatCurrency(pago)}`);
    }
  } else if (ocasiao === "quitado_haver") {
    linhas.push(`💰 Total: ${formatCurrency(totalBruto)}`);
    if ((opts.haverAnterior ?? 0) > 0.009) {
      linhas.push(`Haver anterior: ${formatCurrency(opts.haverAnterior!)}`);
    }
    linhas.push(`💠 Abatido do haver: ${formatCurrency(haverAbatido)}`);
    if ((opts.haverRestante ?? 0) > 0.009) {
      linhas.push(`Haver restante: ${formatCurrency(opts.haverRestante!)}`);
    }
  } else {
    if (totalPago > 0.009) {
      if (pago > 0.009 && haverAbatido > 0.009) {
        linhas.push(
          `✅ Pago: ${formatCurrency(totalPago)} (${formatCurrency(pago)} + haver ${formatCurrency(haverAbatido)})`
        );
      } else {
        linhas.push(`✅ Pago: ${formatCurrency(totalPago)}`);
      }
    } else if (totalBruto > 0.009) {
      linhas.push(`💰 A cobrar: ${formatCurrency(totalBruto)}`);
    }
    if (restante > 0.009) {
      linhas.push(`⏳ Ainda deve: ${formatCurrency(restante)}`);
      if (opts.chavePix?.trim()) linhas.push(`Pix: ${opts.chavePix.trim()}`);
    } else if (totalPago > 0.009 && !opts.previa) {
      linhas.push("✅ Quitado");
    }
  }

  linhas.push("");
  linhas.push(`Ver comprovante: ${opts.url}`);
  linhas.push("");
  linhas.push("_OperaRout_");
  return linhas.join("\n");
}

export function gerarTokenComprovante(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** Snapshot a partir do relatório já na tela (não depende de reler a visita no banco). */
export function snapshotFromRelatorioCassino(input: {
  empresaNome: string;
  pontoNome: string;
  chavePix?: string | null;
  data?: Date | string;
  previa?: boolean;
  maquinas: {
    nome: string;
    lucroCentavos: number;
    entradaAtual?: number;
    saidaAtual?: number;
  }[];
  subtotal: number;
  desconto: number;
  totalACobrar: number;
  valorPago: number;
  restante: number;
  saldoNegativo?: boolean;
  valorOperacional?: number;
  comissao?: number;
  comissaoPercentual?: number;
  prejuizo?: number;
  valorDeixado?: number;
  haverGerado?: number;
  haverAbatido?: number;
  haverRestante?: number;
  haverAnterior?: number;
  totalBruto?: number;
  negativoAnterior?: number;
  negativoRecuperado?: number;
  negativoRestante?: number;
}): ComprovanteSnapshot {
  const dataIso =
    input.data instanceof Date
      ? input.data.toISOString()
      : typeof input.data === "string"
        ? input.data
        : new Date().toISOString();

  const negativo = input.saldoNegativo === true;
  const prejuizoMaquinas = roundMoney(
    input.prejuizo ??
      Math.abs(input.maquinas.reduce((s, m) => s + m.lucroCentavos, 0) / 100)
  );
  const valorDeixado = roundMoney(input.valorDeixado ?? 0);
  const haverGerado = roundMoney(input.haverGerado ?? 0);
  const haverAbatido = roundMoney(input.haverAbatido ?? 0);
  const haverAnterior = roundMoney(
    input.haverAnterior ??
      (haverAbatido > 0.009 || (input.haverRestante ?? 0) > 0.009
        ? haverAbatido + (input.haverRestante ?? 0)
        : 0)
  );
  // Sempre coerente com o que o cliente vê: anterior − abatido na cobrança.
  const haverRestante = roundMoney(
    haverAnterior > 0.009
      ? Math.max(0, haverAnterior - haverAbatido)
      : (input.haverRestante ?? 0)
  );
  const totalLiquido = roundMoney(input.totalACobrar);
  const totalBruto = roundMoney(
    input.totalBruto ??
      (haverAbatido > 0.009 ? totalLiquido + haverAbatido : totalLiquido)
  );
  const negativoAnterior = roundMoney(input.negativoAnterior ?? 0);
  const negativoRecuperado = roundMoney(input.negativoRecuperado ?? 0);
  const negativoRestante = roundMoney(
    input.negativoRestante ??
      Math.max(0, negativoAnterior - negativoRecuperado)
  );

  const maquinas = input.maquinas.map((m) => ({
    nome: m.nome,
    lucro: roundMoney(m.lucroCentavos / 100),
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  }));

  if (negativo) {
    return {
      empresaNome: input.empresaNome.trim() || "Operação",
      chavePix: input.chavePix?.trim() || null,
      pontoNome: input.pontoNome,
      dataIso,
      previa: input.previa === true,
      nichos: [{ label: "Cassino", valor: roundMoney(-prejuizoMaquinas) }],
      maquinas,
      subtotal: 0,
      divida: 0,
      desconto: 0,
      haverAbatido: 0,
      totalACobrar: 0,
      valorPago: roundMoney(input.valorPago),
      restante: 0,
      haverGerado,
      saldoNegativo: true,
      prejuizo: prejuizoMaquinas,
      valorDeixado,
      notas: ["Comissão bloqueada — recupera na próxima positiva"],
    };
  }

  return {
    empresaNome: input.empresaNome.trim() || "Operação",
    chavePix: input.chavePix?.trim() || null,
    pontoNome: input.pontoNome,
    dataIso,
    previa: input.previa === true,
    nichos: [{ label: "Cassino", valor: roundMoney(input.subtotal) }],
    maquinas,
    valorOperacional: roundMoney(input.valorOperacional ?? input.subtotal),
    comissao: roundMoney(input.comissao ?? 0),
    comissaoPercentual: input.comissaoPercentual,
    subtotal: roundMoney(input.subtotal),
    divida: 0,
    desconto: roundMoney(input.desconto),
    haverAbatido,
    totalACobrar: totalLiquido,
    valorPago: roundMoney(input.valorPago),
    restante: roundMoney(input.restante),
    haverGerado: 0,
    haverRestante,
    haverAnterior,
    totalBruto,
    negativoAnterior,
    negativoRecuperado,
    negativoRestante,
  };
}
