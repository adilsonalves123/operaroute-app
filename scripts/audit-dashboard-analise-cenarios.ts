/**
 * Auditoria Dashboard (competência) × Análise (caixa) — cenários cassino.
 * Roda: npx tsx scripts/audit-dashboard-analise-cenarios.ts
 *
 * Não grava no banco: simula cálculo + persistência esperada e aplica as
 * mesmas funções usadas em dashboard-stats / inteligencia-operacional.
 */
import { calcularVisitaCassino } from "../src/lib/nichos/cassino/calculo-visita";
import {
  liquidoRecebidoCassinoVisita,
  lucroOperacaoCassinoVisita,
  type VisitaCassinoLucroInput,
} from "../src/lib/nichos/cassino/lucro-recebido";
import type { CalculoVisitaResult } from "../src/lib/nichos/cassino/types";
import { centesimosToReais } from "../src/lib/nichos/cassino/contadores";

type PendenciaProjetada = {
  tipo: string;
  titulo: string;
  valor: number;
  deltaAReceber: number;
  deltaHaver: number;
  nota?: string;
};

type CenarioResultado = {
  id: string;
  nome: string;
  setup: string;
  lucroMaquina: number;
  comissao: number;
  operacao: number;
  operacaoEfetiva: number;
  pago: number;
  restante: number;
  saldoNegativo: boolean;
  recuperacaoNegativo: number;
  haverCompensado: number;
  haverGerado: number;
  novoDebito: number;
  restanteOperacao: number;
  dashboardLucro: number;
  analiseLiquido: number;
  deltaDashboardVsAnalise: number;
  aReceberDelta: number;
  haverDelta: number;
  pendencias: PendenciaProjetada[];
  okProgramado: boolean;
  checks: { ok: boolean; msg: string }[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function leitura(entradaAtual: number, saidaAtual = 0) {
  return [
    {
      equipamentoId: "m1",
      nome: "Máquina Audit",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual,
      saidaAtual,
    },
  ];
}

/** Espelha o que a API grava e o que dashboard/análise leem da visita. */
function visitaFromCalculo(c: CalculoVisitaResult): VisitaCassinoLucroInput {
  return {
    saldo_negativo: c.saldoNegativo,
    total_lucro_centavos: c.totalLucroCentavos,
    valor_operacao: c.valorOperacaoReais,
    valor_operacao_efetivo: c.valorOperacaoEfetivoReais,
    valor_pago: c.valorPagoReais,
    restante: c.restanteReais,
    desconto: c.saldoNegativo
      ? c.descontoManualReais
      : c.valorDeixadoOperadorReais > 0.009
        ? c.valorDeixadoOperadorReais
        : c.descontoManualReais,
    adiantamento_pix: 0,
    adiantamento_dinheiro: 0,
  };
}

/**
 * Projeta efeito líquido nas pendências abertas (estoque Dashboard/Análise).
 * Valores já existentes abertos entram no setup; deltas = o que a visita gera/fecha.
 */
function projetarPendencias(
  c: CalculoVisitaResult,
  opts: {
    debitoAbertoAntes?: number;
    haverAbertoAntes?: number;
    pendOpAntes?: number;
    descontarHaver?: boolean;
  } = {}
): PendenciaProjetada[] {
  const out: PendenciaProjetada[] = [];
  const debitoAntes = opts.debitoAbertoAntes ?? 0;
  const haverAntes = opts.haverAbertoAntes ?? 0;
  const pendOpAntes = opts.pendOpAntes ?? 0;

  if (c.saldoNegativo) {
    const operadorRepostou = c.descontoManualReais > 0.009 || c.valorDeixadoOperadorReais > 0.009;
    if (c.haverGeradoReais > 0.009) {
      if (operadorRepostou) {
        out.push({
          tipo: "pagamento_pendente",
          titulo: "Pendência da visita negativa",
          valor: c.haverGeradoReais,
          deltaAReceber: c.haverGeradoReais,
          deltaHaver: 0,
          nota: "API: com valor deixado, resto do prejuízo vira pendência (não haver)",
        });
      } else {
        out.push({
          tipo: "haver",
          titulo: "Cliente pagou ganhadores",
          valor: c.haverGeradoReais,
          deltaAReceber: 0,
          deltaHaver: c.haverGeradoReais,
          nota: "API: sem deixar dinheiro → haver (cliente cobriu)",
        });
      }
    }
    if (c.novoDebitoReais > 0.009) {
      out.push({
        tipo: "negativo",
        titulo: "Saldo negativo da coleta",
        valor: c.novoDebitoReais,
        deltaAReceber: c.novoDebitoReais,
        deltaHaver: 0,
        nota: "valor que o operador deixou / financiou",
      });
    }
    if (c.excedenteDeixadoReais > 0.009) {
      out.push({
        tipo: "pagamento_pendente",
        titulo: "Excedente deixado na visita",
        valor: c.excedenteDeixadoReais,
        deltaAReceber: c.excedenteDeixadoReais,
        deltaHaver: 0,
      });
    }
    return out;
  }

  // Recuperação de negativo pelo lucro: fecha/reduz estoque a receber de negativo
  if (debitoAntes > 0.009 && c.recuperacaoNegativoReais > 0.009) {
    const fecha = Math.min(debitoAntes, c.recuperacaoNegativoReais);
    out.push({
      tipo: "negativo",
      titulo: "Baixa por recuperação no lucro",
      valor: -fecha,
      deltaAReceber: -fecha,
      deltaHaver: 0,
      nota: "negativo anterior abatido pelo lucro da visita",
    });
  }

  // Haver abatido na cobrança
  if ((opts.descontarHaver || c.haverCompensadoReais > 0.009) && haverAntes > 0.009) {
    const abate = Math.min(haverAntes, c.haverCompensadoReais);
    if (abate > 0.009) {
      out.push({
        tipo: "haver",
        titulo: "Haver abatido na cobrança",
        valor: -abate,
        deltaAReceber: 0,
        deltaHaver: -abate,
      });
    }
  }

  // Pendência de operação: a API NÃO fecha a antiga sem pagamento;
  // grava nova linha com restanteOperacao (só a dívida desta visita / op efetiva residual).
  if (c.restanteOperacaoReais > 0.009) {
    out.push({
      tipo: c.valorPagoReais > 0.009 ? "parcial" : "pagamento_pendente",
      titulo: "Pagamento pendente da operação",
      valor: c.restanteOperacaoReais,
      deltaAReceber: c.restanteOperacaoReais,
      deltaHaver: 0,
      nota:
        pendOpAntes > 0.009
          ? `Pendência anterior R$ ${pendOpAntes} permanece aberta; nova = restanteOperacao`
          : undefined,
    });
  } else if (pendOpAntes > 0.009 && c.pendenciaOperacaoAbatidaReais > 0.009) {
    out.push({
      tipo: "pagamento_pendente",
      titulo: "Pendência operação quitada",
      valor: -c.pendenciaOperacaoAbatidaReais,
      deltaAReceber: -c.pendenciaOperacaoAbatidaReais,
      deltaHaver: 0,
    });
  }

  if (c.haverReais > 0.009 || c.haverGeradoReais > 0.009) {
    const h = Math.max(c.haverReais, c.haverGeradoReais);
    out.push({
      tipo: "haver",
      titulo: "Haver do cliente",
      valor: h,
      deltaAReceber: 0,
      deltaHaver: h,
    });
  }

  return out;
}

function avaliarCenario(
  id: string,
  nome: string,
  setup: string,
  c: CalculoVisitaResult,
  opts: {
    debitoAbertoAntes?: number;
    haverAbertoAntes?: number;
    pendOpAntes?: number;
    descontarHaver?: boolean;
    expect?: {
      dashboard?: number;
      analise?: number;
      aReceberDelta?: number;
      haverDelta?: number;
    };
  } = {}
): CenarioResultado {
  const visita = visitaFromCalculo(c);
  const dashboardLucro = lucroOperacaoCassinoVisita(visita);
  const analiseLiquido = liquidoRecebidoCassinoVisita(visita);
  const pendencias = projetarPendencias(c, opts);
  const aReceberDelta = round2(pendencias.reduce((s, p) => s + p.deltaAReceber, 0));
  const haverDelta = round2(pendencias.reduce((s, p) => s + p.deltaHaver, 0));

  const checks: { ok: boolean; msg: string }[] = [];

  // Regras programadas
  if (c.saldoNegativo) {
    checks.push({
      ok: Math.abs(dashboardLucro - centesimosToReais(c.totalLucroCentavos)) < 0.02,
      msg: `Dashboard negativa = lucro máquina (${centesimosToReais(c.totalLucroCentavos)})`,
    });
    const deixado = Math.max(c.descontoManualReais, 0);
    const analiseEsp = deixado > 0.009 ? -deixado : 0;
    checks.push({
      ok: Math.abs(analiseLiquido - analiseEsp) < 0.02,
      msg: `Análise negativa = ${analiseEsp} (só sai caixa se deixou dinheiro)`,
    });
  } else {
    const op = Math.max(0, c.valorOperacaoEfetivoReais || c.valorOperacaoReais);
    checks.push({
      ok: Math.abs(dashboardLucro - op) < 0.02,
      msg: `Dashboard positiva = operação efetiva (${op}) mesmo sem pagamento`,
    });
    const analiseEsp = round2(Math.min(op, Math.max(0, c.valorPagoReais)));
    checks.push({
      ok: Math.abs(analiseLiquido - analiseEsp) < 0.02,
      msg: `Análise positiva = min(op, pago) = ${analiseEsp}; haver abatido NÃO conta`,
    });
  }

  if (opts.expect?.dashboard != null) {
    checks.push({
      ok: Math.abs(dashboardLucro - opts.expect.dashboard) < 0.02,
      msg: `Esperado Dashboard ${opts.expect.dashboard}`,
    });
  }
  if (opts.expect?.analise != null) {
    checks.push({
      ok: Math.abs(analiseLiquido - opts.expect.analise) < 0.02,
      msg: `Esperado Análise ${opts.expect.analise}`,
    });
  }
  if (opts.expect?.aReceberDelta != null) {
    checks.push({
      ok: Math.abs(aReceberDelta - opts.expect.aReceberDelta) < 0.05,
      msg: `Esperado Δ A receber ${opts.expect.aReceberDelta} (got ${aReceberDelta})`,
    });
  }
  if (opts.expect?.haverDelta != null) {
    checks.push({
      ok: Math.abs(haverDelta - opts.expect.haverDelta) < 0.05,
      msg: `Esperado Δ Haver ${opts.expect.haverDelta} (got ${haverDelta})`,
    });
  }

  return {
    id,
    nome,
    setup,
    lucroMaquina: round2(centesimosToReais(c.totalLucroCentavos)),
    comissao: round2(c.valorClienteReais),
    operacao: round2(c.valorOperacaoReais),
    operacaoEfetiva: round2(c.valorOperacaoEfetivoReais),
    pago: round2(c.valorPagoReais),
    restante: round2(c.restanteReais),
    saldoNegativo: c.saldoNegativo,
    recuperacaoNegativo: round2(c.recuperacaoNegativoReais),
    haverCompensado: round2(c.haverCompensadoReais),
    haverGerado: round2(Math.max(c.haverGeradoReais, c.haverReais)),
    novoDebito: round2(c.novoDebitoReais),
    restanteOperacao: round2(c.restanteOperacaoReais),
    dashboardLucro,
    analiseLiquido,
    deltaDashboardVsAnalise: round2(dashboardLucro - analiseLiquido),
    aReceberDelta,
    haverDelta,
    pendencias,
    okProgramado: checks.every((x) => x.ok),
    checks,
  };
}

const COM = 30;

const cenarios: CenarioResultado[] = [];

// 1) Positivo simples quitado
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000), // R$ 1000 lucro
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 700, // 70% operação
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "pos-quitado",
      "Positivo simples (quitado)",
      "Lucro R$1000 · comissão 30% · pago R$700",
      c,
      { expect: { dashboard: 700, analise: 700, aReceberDelta: 0, haverDelta: 0 } }
    )
  );
}

// 2) Positivo sem pagamento → pendência
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000),
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "pos-pendente",
      "Positivo + pendência (sem pagar)",
      "Lucro R$1000 · comissão 30% · pago R$0",
      c,
      { expect: { dashboard: 700, analise: 0, aReceberDelta: 700, haverDelta: 0 } }
    )
  );
}

// 3) Negativo sem deixar dinheiro → novo débito
{
  const c = calcularVisitaCassino({
    leituras: leitura(0, 50_000), // prejuízo R$500
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "neg-debito",
      "Negativo (sem deixar dinheiro)",
      "Prejuízo R$500 · sem adiantamento",
      c,
      {
        expect: {
          dashboard: -500,
          analise: 0,
          aReceberDelta: 0,
          haverDelta: 500, // vira haver "Cliente pagou ganhadores"
        },
      }
    )
  );
}

// 4) Negativo deixando dinheiro (cobertura parcial)
{
  const c = calcularVisitaCassino({
    leituras: leitura(0, 50_000),
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 200,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "neg-deixado",
      "Negativo com valor deixado",
      "Prejuízo R$500 · deixa R$200 no ponto",
      c,
      {
        expect: {
          dashboard: -500,
          analise: -200,
          // pendência 300 (resto) + negativo 200 (deixado) = a receber +500
          aReceberDelta: 500,
          haverDelta: 0,
        },
      }
    )
  );
}

// 5) Negativo: cliente pagou ganhadores → gera haver (sem deixar)
{
  // Em negativa pura sem deixar, haverGerado = prejuízo (cliente cobriu)
  // Na API: se não deixou dinheiro e haverGerado > 0 → tipo haver
  const c = calcularVisitaCassino({
    leituras: leitura(0, 30_000),
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  // No fluxo negativo padrão da calc, haverGerado = restantePrejuizo quando operador não repõe
  cenarios.push(
    avaliarCenario(
      "neg-haver",
      "Negativo → gera haver (cliente pagou)",
      "Prejuízo R$300 · sem deixar · haver do cliente",
      c,
      {
        expect: {
          dashboard: -300,
          analise: 0,
          aReceberDelta: 0,
          haverDelta: 300,
        },
      }
    )
  );
}

// 6) Recuperação de negativo (positivo com débito aberto) — sem pagamento
{
  const c = calcularVisitaCassino({
    leituras: leitura(90_000), // R$900
    pendenciasNegativas: [{ id: "n1", valor: 770, observacao: null }],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  // base comissão 130 → op 91; total a cobrar 861 (770+91)
  cenarios.push(
    avaliarCenario(
      "recup-negativo",
      "Recuperação de negativo (sem pagar)",
      "Lucro R$900 · negativo aberto R$770 · pago R$0",
      c,
      {
        debitoAbertoAntes: 770,
        expect: {
          dashboard: 91,
          analise: 0,
          aReceberDelta: round2(-770 + 861), // fecha 770, abre 861 op
        },
      }
    )
  );
}

// 7) Recuperação de negativo — pago integral
{
  const c = calcularVisitaCassino({
    leituras: leitura(90_000),
    pendenciasNegativas: [{ id: "n1", valor: 770, observacao: null }],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 861,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "recup-negativo-pago",
      "Recuperação de negativo (pago)",
      "Lucro R$900 · negativo R$770 · pago R$861",
      c,
      {
        debitoAbertoAntes: 770,
        expect: {
          dashboard: 91,
          analise: 91, // min(op, pago) — pago 861 mas op efetiva 91
          aReceberDelta: -770,
          haverDelta: 0,
        },
      }
    )
  );
}

// 8) Abatimento / recuperação de haver na cobrança
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000),
    pendenciasNegativas: [],
    pendenciasHaver: [{ id: "h1", valor: 200, observacao: null }],
    descontarHaverNaCobranca: true,
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 500, // total a cobrar = 700-200 = 500
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "haver-abate",
      "Haver abatido na cobrança (quitado)",
      "Lucro R$1000 · haver aberto R$200 · desconta haver · pago R$500",
      c,
      {
        haverAbertoAntes: 200,
        descontarHaver: true,
        expect: {
          dashboard: 700, // operação plena (haver não reduz lucro competência)
          analise: 500, // só caixa pago; haver NÃO conta como recebido
          aReceberDelta: 0,
          haverDelta: -200,
        },
      }
    )
  );
}

// 9) Positivo + pendência operação incluída, sem pagar
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000),
    pendenciasNegativas: [],
    pendenciasOperacao: [{ id: "op1", valor: 150, observacao: null }],
    incluirPendenciasOperacao: true,
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "pos-pend-op",
      "Positivo + pendência de operação",
      "Lucro R$1000 · pendência op R$150 · pago R$0",
      c,
      {
        pendOpAntes: 150,
        expect: {
          dashboard: 700,
          analise: 0,
          // Nova pendência = restanteOperacao (700); a antiga de 150 continua aberta
          aReceberDelta: 700,
        },
      }
    )
  );
}

// 10) Pendência + haver juntos
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000),
    pendenciasNegativas: [],
    pendenciasOperacao: [{ id: "op1", valor: 150, observacao: null }],
    pendenciasHaver: [{ id: "h1", valor: 61, observacao: null }],
    incluirPendenciasOperacao: true,
    descontarHaverNaCobranca: true,
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 0,
    valorDinheiroReais: 0,
  });
  // totalAntesHaver = 0 + 700 + 150 = 850; −61 haver → 789 restante
  cenarios.push(
    avaliarCenario(
      "pend-haver",
      "Pendência + haver juntos",
      "Lucro R$1000 · pend op R$150 · haver R$61 descontado · pago R$0",
      c,
      {
        pendOpAntes: 150,
        haverAbertoAntes: 61,
        descontarHaver: true,
        expect: {
          dashboard: 700,
          analise: 0,
          haverDelta: -61,
          aReceberDelta: 639, // restanteOperacao após haver
        },
      }
    )
  );
}

// 11) Overpay → gera haver
{
  const c = calcularVisitaCassino({
    leituras: leitura(100_000),
    pendenciasNegativas: [],
    comissaoPercentual: COM,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    valorPixReais: 800,
    valorDinheiroReais: 0,
  });
  cenarios.push(
    avaliarCenario(
      "overpay-haver",
      "Pagamento a mais → gera haver",
      "Lucro R$1000 · op R$700 · pago R$800",
      c,
      {
        expect: {
          dashboard: 700,
          analise: 700, // capped na operação
          aReceberDelta: 0,
          haverDelta: 100,
        },
      }
    )
  );
}

const fails = cenarios.filter((c) => !c.okProgramado);
const summary = {
  total: cenarios.length,
  ok: cenarios.filter((c) => c.okProgramado).length,
  fail: fails.length,
  regras: {
    dashboard:
      "Competência: positiva = valor_operacao_efetivo; negativa = lucro máquina (pode ser < 0).",
    analise:
      "Caixa: positiva = min(op, valor_pago); negativa = −valor deixado (0 se não deixou).",
    haver:
      "Haver abatido reduz A haver / cobrança, mas NÃO entra no Líquido da Análise.",
    aReceber:
      "Estoque de pendências abertas (negativo / pagamento_pendente / parcial), não o hero lucro.",
  },
  cenarios,
};

console.log(JSON.stringify(summary, null, 2));

if (fails.length) {
  console.error("\nFALHAS:");
  for (const f of fails) {
    console.error(`- ${f.id}: ${f.checks.filter((x) => !x.ok).map((x) => x.msg).join(" | ")}`);
  }
  process.exit(1);
}

console.error(`\nOK ${summary.ok}/${summary.total} cenários batem com o programado.`);
