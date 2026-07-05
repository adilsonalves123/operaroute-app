/**
 * Verificação rápida da lógica cassino (rodar: npx tsx scripts/verify-cassino-calculo.ts)
 */
import {
  calcularVisitaCassino,
  centesimosToReais,
  formatContador,
  hintAdiantamento,
  valorSaidaCaixaAdiantamento,
  buildResumoFinanceiroLinhas,
  comissaoBloqueada,
} from "../src/lib/nichos/cassino";
import { parseMoneyInput } from "../src/lib/utils";

/** Espelha a saída financeira registrada em visitas/cassino/route.ts */
function saidaFinanceiroAdiantamento(
  pixReais: number,
  dinheiroReais: number,
  pixDoCaixa: boolean,
  dinheiroDoCaixa: boolean
): number {
  return valorSaidaCaixaAdiantamento({
    pixReais,
    dinheiroReais,
    pixDoCaixa,
    dinheiroDoCaixa,
  });
}

for (const [raw, expected] of [
  ["690", 690],
  ["690,00", 690],
  ["1.000,00", 1000],
  ["1.234,56", 1234.56],
] as const) {
  const got = parseMoneyInput(raw);
  if (Math.abs(got - expected) > 0.001) {
    console.error("FAIL: parseMoneyInput", raw, "esperado", expected, "got", got);
    process.exit(1);
  }
}

// Cenário usuário: lucro 900, negativo 770, comissão 30%, sem pagamento
const paulinho = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 90_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [{ id: "p1", valor: 770, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

if (Math.abs(paulinho.recuperacaoNegativoReais - 770) > 0.02) {
  console.error("FAIL: recuperação negativo esperada 770, got", paulinho.recuperacaoNegativoReais);
  process.exit(1);
}

if (Math.abs(paulinho.debitoAbatidoReais) > 0.02) {
  console.error("FAIL: negativo só quita com dinheiro — esperado 0, got", paulinho.debitoAbatidoReais);
  process.exit(1);
}

if (Math.abs(paulinho.debitoRestanteReais) > 0.02) {
  console.error("FAIL: negativo quitado por lucro — debitoRestante deveria ser 0, got", paulinho.debitoRestanteReais);
  process.exit(1);
}

if (Math.abs(paulinho.saldoAposDebitoReais - 130) > 0.02) {
  console.error("FAIL: base comissão esperada 130, got", paulinho.saldoAposDebitoReais);
  process.exit(1);
}

if (Math.abs(paulinho.valorClienteReais - 39) > 0.02) {
  console.error("FAIL: comissão esperada 39, got", paulinho.valorClienteReais);
  process.exit(1);
}

if (Math.abs(paulinho.valorOperacaoReais - 91) > 0.02) {
  console.error("FAIL: valor operação esperado 91, got", paulinho.valorOperacaoReais);
  process.exit(1);
}

if (Math.abs(paulinho.totalACobrarReais - 861) > 0.02) {
  console.error("FAIL: total a cobrar esperado 861, got", paulinho.totalACobrarReais);
  process.exit(1);
}

if (Math.abs(paulinho.restanteOperacaoReais - 861) > 0.02) {
  console.error("FAIL: dívida operação (cobrança total) esperada 861, got", paulinho.restanteOperacaoReais);
  process.exit(1);
}

if (Math.abs(paulinho.restanteReais - 861) > 0.02) {
  console.error("FAIL: total em aberto esperado 861, got", paulinho.restanteReais);
  process.exit(1);
}

if (!paulinho.comissaoAplicada) {
  console.error("FAIL: comissão deveria estar aplicada na base");
  process.exit(1);
}

if (comissaoBloqueada(paulinho)) {
  console.error("FAIL: comissão não deveria aparecer bloqueada com base positiva");
  process.exit(1);
}

// Pagamento integral: 770 negativo + 91 operação
const paulinhoPago = calcularVisitaCassino({
  ...{
    leituras: paulinho.maquinas.map((m) => ({
      equipamentoId: m.equipamentoId,
      nome: m.nome,
      entradaAnterior: m.entradaAnterior,
      saidaAnterior: m.saidaAnterior,
      entradaAtual: m.entradaAtual,
      saidaAtual: m.saidaAtual,
    })),
    pendenciasNegativas: [{ id: "p1", valor: 770, observacao: null }],
    comissaoPercentual: 30,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
  },
  valorPixReais: 861,
  valorDinheiroReais: 0,
});

if (Math.abs(paulinhoPago.debitoAbatidoReais) > 0.02) {
  console.error(
    "FAIL: negativo quitado por lucro — pagamento não abate registro negativo, got",
    paulinhoPago.debitoAbatidoReais
  );
  process.exit(1);
}

if (Math.abs(paulinhoPago.restanteReais) > 0.02) {
  console.error("FAIL: nada em aberto após pagamento integral, got", paulinhoPago.restanteReais);
  process.exit(1);
}

// Lucro menor que negativo: comissão zerada, negativo permanece
const lucroMenor = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 50_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [{ id: "p2", valor: 770, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

if (Math.abs(lucroMenor.recuperacaoNegativoReais - 500) > 0.02) {
  console.error("FAIL: recuperação parcial esperada 500, got", lucroMenor.recuperacaoNegativoReais);
  process.exit(1);
}

if (Math.abs(lucroMenor.debitoAbatidoReais) > 0.02) {
  console.error("FAIL: sem pagamento, negativo não abate, got", lucroMenor.debitoAbatidoReais);
  process.exit(1);
}

if (Math.abs(lucroMenor.valorClienteReais) > 0.02) {
  console.error("FAIL: comissão esperada 0 com lucro < negativo, got", lucroMenor.valorClienteReais);
  process.exit(1);
}

if (!comissaoBloqueada(lucroMenor)) {
  console.error("FAIL: comissão deveria estar bloqueada quando lucro < negativo");
  process.exit(1);
}

// Cenário: 2 máquinas, lucro R$ 2000, débito R$ 100, comissão 30%, pagamento R$ 280
const result = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "Máquina 01",
      entradaAnterior: 1_000_000,
      saidaAnterior: 800_000,
      entradaAtual: 1_300_000,
      saidaAtual: 950_000,
    },
    {
      equipamentoId: "m2",
      nome: "Máquina 02",
      entradaAnterior: 500_000,
      saidaAnterior: 400_000,
      entradaAtual: 700_000,
      saidaAtual: 550_000,
    },
  ],
  pendenciasNegativas: [{ id: "p3", valor: 100, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 280,
  valorDinheiroReais: 0,
});

console.log("=== Cálculo visita cassino ===");
console.log("Lucro total (visor):", formatContador(result.totalLucroCentavos));
console.log("Negativo recebido:", result.debitoAbatidoReais.toFixed(2));
console.log("Base comissão:", result.saldoAposDebitoReais.toFixed(2));
console.log("Comissão cliente:", result.valorClienteReais.toFixed(2));
console.log("Valor operação:", result.valorOperacaoReais.toFixed(2));

if (result.totalLucroCentavos !== 200_000) {
  console.error("FAIL: totalLucroCentavos esperado 200000, got", result.totalLucroCentavos);
  process.exit(1);
}

const expectedOperacao = 1330;
if (Math.abs(result.valorOperacaoReais - expectedOperacao) > 0.02) {
  console.error("FAIL: valorOperacao esperado", expectedOperacao, "got", result.valorOperacaoReais);
  process.exit(1);
}

if (Math.abs(result.debitoAbatidoReais) > 0.02) {
  console.error(
    "FAIL: negativo quitado por lucro — pagamento não abate registro, got",
    result.debitoAbatidoReais
  );
  process.exit(1);
}

if (Math.abs(result.restanteOperacaoReais - 1150) > 0.02) {
  console.error("FAIL: dívida operação esperada 1150, got", result.restanteOperacaoReais);
  process.exit(1);
}

// Visita negativa: valor deixado no ponto vira débito
const visitaNegativa = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-neg",
      nome: "Máquina",
      entradaAnterior: 100_000,
      saidaAnterior: 0,
      entradaAtual: 100_000,
      saidaAtual: 70_000,
    },
  ],
  pendenciasNegativas: [],
  comissaoPercentual: 30,
  descontoManualReais: 700,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

if (!visitaNegativa.saldoNegativo) {
  console.error("FAIL: visita deveria ser negativa");
  process.exit(1);
}

if (Math.abs(visitaNegativa.novoDebitoReais - 700) > 0.02) {
  console.error("FAIL: débito esperado 700 (valor deixado), got", visitaNegativa.novoDebitoReais);
  process.exit(1);
}

if (visitaNegativa.clientePagouGanhadores) {
  console.error("FAIL: operador deixou 700, não deveria ser cliente pagou");
  process.exit(1);
}

// Cliente pagou ganhadores — gera haver, sem débito
const clientePaga = calcularVisitaCassino({
  leituras: visitaNegativa.maquinas.map((m) => ({
    equipamentoId: m.equipamentoId,
    nome: m.nome,
    entradaAnterior: m.entradaAnterior,
    saidaAnterior: m.saidaAnterior,
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  })),
  pendenciasNegativas: [],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (!clientePaga.clientePagouGanhadores) {
  console.error("FAIL: deveria registrar cliente pagou ganhadores");
  process.exit(1);
}

if (Math.abs(clientePaga.haverGeradoReais - 700) > 0.02) {
  console.error("FAIL: haver esperado 700, got", clientePaga.haverGeradoReais);
  process.exit(1);
}

if (Math.abs(clientePaga.novoDebitoReais) > 0.02) {
  console.error("FAIL: não deveria gerar débito quando cliente paga");
  process.exit(1);
}

// Negativa + pendência anterior: recebe 1000, ponto pagou ganhadores 1200 → saldo -200
const negativeComPendencia = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-np",
      nome: "Máquina",
      entradaAnterior: 100_000,
      saidaAnterior: 100_000,
      entradaAtual: 100_000,
      saidaAtual: 220_000,
    },
  ],
  pendenciasNegativas: [],
  pendenciasOperacao: [{ id: "po1", valor: 1000, observacao: null }],
  abaterPendenciaOperacaoNegativa: false,
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 1000,
  valorDinheiroReais: 0,
});

if (Math.abs(negativeComPendencia.pendenciaOperacaoAbatidaReais - 1000) > 0.02) {
  console.error(
    "FAIL: pendência abatida esperada 1000, got",
    negativeComPendencia.pendenciaOperacaoAbatidaReais
  );
  process.exit(1);
}

if (Math.abs(negativeComPendencia.haverGeradoReais - 1200) > 0.02) {
  console.error("FAIL: haver gerado esperado 1200, got", negativeComPendencia.haverGeradoReais);
  process.exit(1);
}

if (Math.abs(negativeComPendencia.saldoLiquidoReais - -200) > 0.02) {
  console.error("FAIL: saldo líquido esperado -200, got", negativeComPendencia.saldoLiquidoReais);
  process.exit(1);
}

// Negativa parcial: deixou 200 de 1200 → negativo 200 + haver 1000
const negativeParcial = calcularVisitaCassino({
  leituras: negativeComPendencia.maquinas.map((m) => ({
    equipamentoId: m.equipamentoId,
    nome: m.nome,
    entradaAnterior: m.entradaAnterior,
    saidaAnterior: m.saidaAnterior,
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  })),
  pendenciasNegativas: [],
  comissaoPercentual: 30,
  descontoManualReais: 200,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(negativeParcial.novoDebitoReais - 200) > 0.02) {
  console.error("FAIL: negativo parcial esperado 200, got", negativeParcial.novoDebitoReais);
  process.exit(1);
}

if (Math.abs(negativeParcial.haverGeradoReais - 1000) > 0.02) {
  console.error("FAIL: haver parcial esperado 1000, got", negativeParcial.haverGeradoReais);
  process.exit(1);
}

// Negativa com haver existente: usar haver cobre prejuízo 200
const negativeUsaHaver = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-nh",
      nome: "Máquina",
      entradaAnterior: 100_000,
      saidaAnterior: 100_000,
      entradaAtual: 100_000,
      saidaAtual: 120_000,
    },
  ],
  pendenciasNegativas: [],
  pendenciasHaver: [{ id: "h-neg", valor: 1000, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  incluirUsarHaverNegativo: true,
});

if (Math.abs(negativeUsaHaver.haverCompensadoReais - 200) > 0.02) {
  console.error(
    "FAIL: haver compensado esperado 200, got",
    negativeUsaHaver.haverCompensadoReais
  );
  process.exit(1);
}

if (Math.abs(negativeUsaHaver.haverGeradoReais) > 0.02) {
  console.error("FAIL: não deveria gerar haver novo, got", negativeUsaHaver.haverGeradoReais);
  process.exit(1);
}

// Negativa + abate dívida anterior: prejuízo 1000, abate 400, caixa 600 → negativo 1000
const negativeAbatePendencia = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-ab",
      nome: "Máquina",
      entradaAnterior: 100_000,
      saidaAnterior: 100_000,
      entradaAtual: 100_000,
      saidaAtual: 200_000,
    },
  ],
  pendenciasNegativas: [],
  pendenciasOperacao: [{ id: "po-ab", valor: 400, observacao: null }],
  abaterPendenciaOperacaoNegativa: true,
  comissaoPercentual: 30,
  descontoManualReais: 600,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(negativeAbatePendencia.pendenciaOperacaoAbatidaReais - 400) > 0.02) {
  console.error(
    "FAIL: abatimento pendência esperado 400, got",
    negativeAbatePendencia.pendenciaOperacaoAbatidaReais
  );
  process.exit(1);
}

if (Math.abs(negativeAbatePendencia.valorDeixadoOperadorReais - 600) > 0.02) {
  console.error(
    "FAIL: caixa hoje esperado 600, got",
    negativeAbatePendencia.valorDeixadoOperadorReais
  );
  process.exit(1);
}

if (Math.abs(negativeAbatePendencia.novoDebitoReais - 1000) > 0.02) {
  console.error(
    "FAIL: negativo a recuperar esperado 1000, got",
    negativeAbatePendencia.novoDebitoReais
  );
  process.exit(1);
}

if (Math.abs(negativeAbatePendencia.haverGeradoReais) > 0.02) {
  console.error("FAIL: não deveria gerar haver, got", negativeAbatePendencia.haverGeradoReais);
  process.exit(1);
}

// Pulinho: negativa abate R$ 200 de operação pendente e repõe R$ 1.000 (prejuízo R$ 1.200)
const pulinhoNegativa = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-pul-n",
      nome: "Máquina",
      entradaAnterior: 60_000,
      saidaAnterior: 0,
      entradaAtual: 60_000,
      saidaAtual: 120_000,
    },
  ],
  pendenciasNegativas: [],
  pendenciasOperacao: [{ id: "po-pul-200", valor: 200, observacao: null }],
  abaterPendenciaOperacaoNegativa: true,
  comissaoPercentual: 30,
  descontoManualReais: 1000,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(pulinhoNegativa.pendenciaOperacaoAbatidaReais - 200) > 0.02) {
  console.error(
    "FAIL: Pulinho negativa — deveria abater 200 da operação, got",
    pulinhoNegativa.pendenciaOperacaoAbatidaReais
  );
  process.exit(1);
}

if (pulinhoNegativa.abatimentosPendenciaOperacao.length !== 1) {
  console.error(
    "FAIL: Pulinho negativa — deveria gerar 1 abatimento de operação, got",
    pulinhoNegativa.abatimentosPendenciaOperacao.length
  );
  process.exit(1);
}

if (!pulinhoNegativa.abatimentosPendenciaOperacao[0]?.resolvida) {
  console.error("FAIL: Pulinho negativa — pendência de R$ 200 deveria ficar resolvida");
  process.exit(1);
}

if (Math.abs(pulinhoNegativa.haverGeradoReais) > 0.02) {
  console.error(
    "FAIL: Pulinho negativa — não deveria gerar restante após abater 200 e repor 1000, got",
    pulinhoNegativa.haverGeradoReais
  );
  process.exit(1);
}

if (Math.abs(pulinhoNegativa.novoDebitoReais - 1200) > 0.02) {
  console.error(
    "FAIL: Pulinho negativa — negativo a recuperar esperado 1200, got",
    pulinhoNegativa.novoDebitoReais
  );
  process.exit(1);
}

// Positiva: lucro 1200 cobre negativo 1200; cliente paga só 1000 → R$ 200 vira dívida operação
const positivaNegQuitadoLucro = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-pq",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 120_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [{ id: "neg-1200", valor: 1200, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 1000,
  valorDinheiroReais: 0,
});

if (Math.abs(positivaNegQuitadoLucro.recuperacaoNegativoReais - 1200) > 0.02) {
  console.error(
    "FAIL: recuperação negativo esperada 1200, got",
    positivaNegQuitadoLucro.recuperacaoNegativoReais
  );
  process.exit(1);
}

if (Math.abs(positivaNegQuitadoLucro.debitoRestanteReais) > 0.02) {
  console.error(
    "FAIL: negativo quitado por lucro — debitoRestante deveria ser 0, got",
    positivaNegQuitadoLucro.debitoRestanteReais
  );
  process.exit(1);
}

if (Math.abs(positivaNegQuitadoLucro.restanteOperacaoReais - 200) > 0.02) {
  console.error(
    "FAIL: falta pagamento deveria virar operação 200, got",
    positivaNegQuitadoLucro.restanteOperacaoReais
  );
  process.exit(1);
}

if (!positivaNegQuitadoLucro.abatimentos.every((a) => a.resolvida)) {
  console.error("FAIL: abatimentos de lucro deveriam resolver negativo por completo");
  process.exit(1);
}

// Haver 1000, lucro 900 — operação zero, sobra haver 100
const comHaver = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-h",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 90_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [],
  pendenciasHaver: [{ id: "h1", valor: 1000, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(comHaver.haverCompensadoReais - 900) > 0.02) {
  console.error("FAIL: haver compensado esperado 900, got", comHaver.haverCompensadoReais);
  process.exit(1);
}

if (Math.abs(comHaver.valorOperacaoReais) > 0.02) {
  console.error("FAIL: valor operação esperado 0 com haver cobrindo lucro, got", comHaver.valorOperacaoReais);
  process.exit(1);
}

if (Math.abs(comHaver.haverRestanteReais - 100) > 0.02) {
  console.error("FAIL: haver restante esperado 100, got", comHaver.haverRestanteReais);
  process.exit(1);
}

// Lucro 300, haver 200 — comissão só sobre os 100 que sobram
const haverParcial = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-hp",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 50_000,
      saidaAtual: 20_000,
    },
  ],
  pendenciasNegativas: [],
  pendenciasHaver: [{ id: "h2", valor: 200, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(haverParcial.haverCompensadoReais - 200) > 0.02) {
  console.error("FAIL: haver compensado esperado 200, got", haverParcial.haverCompensadoReais);
  process.exit(1);
}

if (Math.abs(haverParcial.saldoAposDebitoReais - 100) > 0.02) {
  console.error("FAIL: base comissão esperada 100, got", haverParcial.saldoAposDebitoReais);
  process.exit(1);
}

if (Math.abs(haverParcial.valorClienteReais - 30) > 0.02) {
  console.error("FAIL: comissão esperada 30 sobre os 100, got", haverParcial.valorClienteReais);
  process.exit(1);
}

if (Math.abs(haverParcial.valorOperacaoReais - 70) > 0.02) {
  console.error("FAIL: valor operação esperado 70, got", haverParcial.valorOperacaoReais);
  process.exit(1);
}

if (Math.abs(haverParcial.totalACobrarReais - 70) > 0.02) {
  console.error("FAIL: total a cobrar esperado 70, got", haverParcial.totalACobrarReais);
  process.exit(1);
}

// Operador pode quitar os 100 restantes do haver
const comHaverPago = calcularVisitaCassino({
  ...{
    leituras: comHaver.maquinas.map((m) => ({
      equipamentoId: m.equipamentoId,
      nome: m.nome,
      entradaAnterior: m.entradaAnterior,
      saidaAnterior: m.saidaAnterior,
      entradaAtual: m.entradaAtual,
      saidaAtual: m.saidaAtual,
    })),
    pendenciasNegativas: [],
    pendenciasHaver: [{ id: "h1", valor: 1000, observacao: null }],
    comissaoPercentual: 30,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
  },
  descontoManualReais: 100,
});

if (Math.abs(comHaverPago.haverRestanteReais) > 0.02) {
  console.error("FAIL: haver deveria zerar após pagar 100, got", comHaverPago.haverRestanteReais);
  process.exit(1);
}

// Cliente pagou a mais na operação → novo haver (não quita haver do ponto)
const comHaverOverpay = calcularVisitaCassino({
  leituras: comHaver.maquinas.map((m) => ({
    equipamentoId: m.equipamentoId,
    nome: m.nome,
    entradaAnterior: m.entradaAnterior,
    saidaAnterior: m.saidaAnterior,
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  })),
  pendenciasNegativas: [],
  pendenciasHaver: [{ id: "h1", valor: 1000, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 100,
  valorDinheiroReais: 0,
});

if (Math.abs(comHaverOverpay.valorOperacaoReais) > 0.02) {
  console.error("FAIL: operação deveria ser 0, got", comHaverOverpay.valorOperacaoReais);
  process.exit(1);
}

if (Math.abs(comHaverOverpay.haverQuitadoReais) > 0.02) {
  console.error(
    "FAIL: cliente não quita haver do ponto — operador paga, got quitado",
    comHaverOverpay.haverQuitadoReais
  );
  process.exit(1);
}

if (Math.abs(comHaverOverpay.haverReais - 100) > 0.02) {
  console.error("FAIL: excedente do cliente deveria virar haver 100, got", comHaverOverpay.haverReais);
  process.exit(1);
}

if (Math.abs(comHaverOverpay.haverRestanteReais - 100) > 0.02) {
  console.error("FAIL: haver do ponto ainda em aberto 100, got", comHaverOverpay.haverRestanteReais);
  process.exit(1);
}

// Desconto manual com negativo anterior aberto: ignorado em visita positiva
const comAjuda = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m3",
      nome: "Máquina ajuda",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 100_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [{ id: "p4", valor: 1800, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 300,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

if (Math.abs(comAjuda.recuperacaoNegativoReais - 1000) > 0.02) {
  console.error("FAIL: recuperação na base esperada 1000, got", comAjuda.recuperacaoNegativoReais);
  process.exit(1);
}

if (Math.abs(comAjuda.descontoManualReais) > 0.02) {
  console.error("FAIL: desconto manual ignorado com negativo aberto, got", comAjuda.descontoManualReais);
  process.exit(1);
}

const comPagamentoParcial = calcularVisitaCassino({
  leituras: comAjuda.maquinas.map((m) => ({
    equipamentoId: m.equipamentoId,
    nome: m.nome,
    entradaAnterior: m.entradaAnterior,
    saidaAnterior: m.saidaAnterior,
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  })),
  pendenciasNegativas: [{ id: "p4", valor: 1800, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 300,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 500,
  valorDinheiroReais: 0,
});

if (Math.abs(comPagamentoParcial.debitoAbatidoReais - 500) > 0.02) {
  console.error("FAIL: negativo recebido esperado 500, got", comPagamentoParcial.debitoAbatidoReais);
  process.exit(1);
}

if (Math.abs(comPagamentoParcial.debitoRestanteReais - 1300) > 0.02) {
  console.error("FAIL: negativo em aberto esperado 1300, got", comPagamentoParcial.debitoRestanteReais);
  process.exit(1);
}

// Excedente sem incluir pendência no total — abate pendência anterior
const comOverpayPendencia = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-op",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 100_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [],
  pendenciasOperacao: [{ id: "po1", valor: 300, observacao: null }],
  incluirPendenciasOperacao: false,
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 1000,
  valorDinheiroReais: 0,
});

if (Math.abs(comOverpayPendencia.totalACobrarReais - 700) > 0.02) {
  console.error("FAIL: total sem incluir pendência esperado 700, got", comOverpayPendencia.totalACobrarReais);
  process.exit(1);
}

if (Math.abs(comOverpayPendencia.pendenciaOperacaoAbatidaReais - 300) > 0.02) {
  console.error(
    "FAIL: excedente deveria abater pendência 300, got",
    comOverpayPendencia.pendenciaOperacaoAbatidaReais
  );
  process.exit(1);
}

if (Math.abs(comOverpayPendencia.haverReais) > 0.02) {
  console.error("FAIL: não deveria gerar haver ao abater pendência com excedente, got", comOverpayPendencia.haverReais);
  process.exit(1);
}

// Adiantamento Pix/dinheiro + caixa (helpers de relatório e saída financeira)
const adiantamentoSoPix = {
  pixReais: 300,
  dinheiroReais: 0,
  pixDoCaixa: true,
  dinheiroDoCaixa: false,
};
if (Math.abs(valorSaidaCaixaAdiantamento(adiantamentoSoPix) - 300) > 0.02) {
  console.error(
    "FAIL: saída caixa Pix-only esperada 300, got",
    valorSaidaCaixaAdiantamento(adiantamentoSoPix)
  );
  process.exit(1);
}

const adiantamentoDinheiroForaCaixa = {
  pixReais: 0,
  dinheiroReais: 200,
  pixDoCaixa: false,
  dinheiroDoCaixa: false,
};
if (Math.abs(valorSaidaCaixaAdiantamento(adiantamentoDinheiroForaCaixa)) > 0.02) {
  console.error(
    "FAIL: dinheiro fora do caixa não deveria contar na saída, got",
    valorSaidaCaixaAdiantamento(adiantamentoDinheiroForaCaixa)
  );
  process.exit(1);
}

const adiantamentoMistoCaixa = {
  pixReais: 150,
  dinheiroReais: 50,
  pixDoCaixa: true,
  dinheiroDoCaixa: true,
};
if (Math.abs(valorSaidaCaixaAdiantamento(adiantamentoMistoCaixa) - 200) > 0.02) {
  console.error(
    "FAIL: saída caixa Pix+dinheiro esperada 200, got",
    valorSaidaCaixaAdiantamento(adiantamentoMistoCaixa)
  );
  process.exit(1);
}

const hintMisto = hintAdiantamento(adiantamentoMistoCaixa);
if (!hintMisto?.includes("saiu do caixa")) {
  console.error("FAIL: hint deveria indicar dinheiro saiu do caixa, got", hintMisto);
  process.exit(1);
}

const hintForaCaixa = hintAdiantamento({
  pixReais: 0,
  dinheiroReais: 80,
  pixDoCaixa: false,
  dinheiroDoCaixa: false,
});
if (!hintForaCaixa?.includes("fora do caixa")) {
  console.error("FAIL: hint deveria indicar dinheiro fora do caixa, got", hintForaCaixa);
  process.exit(1);
}

// Negativa parcial com adiantamento Pix + dinheiro (total = desconto_manual na API)
const adiantamentoPix = 150;
const adiantamentoDinheiro = 50;
const adiantamentoPixDoCaixa = true;
const adiantamentoDinheiroDoCaixa = true;
const adiantamentoTotal = adiantamentoPix + adiantamentoDinheiro;

const negativeAdiantamentoMisto = calcularVisitaCassino({
  leituras: negativeParcial.maquinas.map((m) => ({
    equipamentoId: m.equipamentoId,
    nome: m.nome,
    entradaAnterior: m.entradaAnterior,
    saidaAnterior: m.saidaAnterior,
    entradaAtual: m.entradaAtual,
    saidaAtual: m.saidaAtual,
  })),
  pendenciasNegativas: [],
  comissaoPercentual: 30,
  descontoManualReais: adiantamentoTotal,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
});

if (Math.abs(negativeAdiantamentoMisto.novoDebitoReais - adiantamentoTotal) > 0.02) {
  console.error(
    "FAIL: negativo com adiantamento misto esperado",
    adiantamentoTotal,
    "got",
    negativeAdiantamentoMisto.novoDebitoReais
  );
  process.exit(1);
}

if (Math.abs(negativeAdiantamentoMisto.haverGeradoReais - 1000) > 0.02) {
  console.error(
    "FAIL: haver com adiantamento 200/1200 esperado 1000, got",
    negativeAdiantamentoMisto.haverGeradoReais
  );
  process.exit(1);
}

const saidaEsperada = saidaFinanceiroAdiantamento(
  adiantamentoPix,
  adiantamentoDinheiro,
  adiantamentoPixDoCaixa,
  adiantamentoDinheiroDoCaixa
);
if (Math.abs(saidaEsperada - 200) > 0.02) {
  console.error("FAIL: saída financeira adiantamento misto esperada 200, got", saidaEsperada);
  process.exit(1);
}

const saidaSemCaixa = saidaFinanceiroAdiantamento(
  adiantamentoPix,
  adiantamentoDinheiro,
  false,
  false
);
if (Math.abs(saidaSemCaixa) > 0.02) {
  console.error("FAIL: sem caixa nada deveria sair no financeiro, got", saidaSemCaixa);
  process.exit(1);
}

const saidaSoPix = saidaFinanceiroAdiantamento(adiantamentoPix, adiantamentoDinheiro, true, false);
if (Math.abs(saidaSoPix - adiantamentoPix) > 0.02) {
  console.error(
    "FAIL: sem caixa só Pix entra na saída — esperado",
    adiantamentoPix,
    "got",
    saidaSemCaixa
  );
  process.exit(1);
}

const linhasAdiantamento = buildResumoFinanceiroLinhas(
  negativeAdiantamentoMisto,
  30,
  adiantamentoMistoCaixa
);
const linhaOperador = linhasAdiantamento.find((l) => l.label === "Você adiantou");
if (!linhaOperador?.hint?.includes("Pix") || !linhaOperador.hint.includes("saiu do caixa")) {
  console.error(
    "FAIL: resumo deveria incluir hint Pix/dinheiro no adiantamento, got",
    linhaOperador?.hint
  );
  process.exit(1);
}

// API: adiantamento_total substitui desconto_manual quando preenchido
const descontoManualLegado = parseMoneyInput("0");
const adiantamentoTotalApi = 150 + 50;
const descontoManualEfetivo =
  adiantamentoTotalApi > 0.009 ? adiantamentoTotalApi : descontoManualLegado;
if (Math.abs(descontoManualEfetivo - 200) > 0.02) {
  console.error("FAIL: desconto efetivo com adiantamento esperado 200, got", descontoManualEfetivo);
  process.exit(1);
}

// Positiva: lucro 2800, negativo 1400, pagou só negativo → falta operação 980
const positivaNegParcial = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m-pos",
      nome: "Máquina",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 500_000,
      saidaAtual: 220_000,
    },
  ],
  pendenciasNegativas: [{ id: "neg1400", valor: 1400, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  valorPixReais: 1400,
  valorDinheiroReais: 0,
});

if (Math.abs(positivaNegParcial.debitoAbatidoReais - 1400) > 0.02) {
  console.error(
    "FAIL: negativo recebido esperado 1400, got",
    positivaNegParcial.debitoAbatidoReais
  );
  process.exit(1);
}

if (Math.abs(positivaNegParcial.restanteOperacaoReais - 980) > 0.02) {
  console.error("FAIL: operação pendente esperada 980, got", positivaNegParcial.restanteOperacaoReais);
  process.exit(1);
}

if (Math.abs(positivaNegParcial.restanteReais - 980) > 0.02) {
  console.error("FAIL: total em aberto esperado 980, got", positivaNegParcial.restanteReais);
  process.exit(1);
}

const linhasPosNeg = buildResumoFinanceiroLinhas(positivaNegParcial, 30);
const labelsPosNeg = linhasPosNeg.filter((l) => !l.secao).map((l) => l.label);
const baseComissaoCount = labelsPosNeg.filter((l) => l === "Base para comissão").length;
if (baseComissaoCount !== 1) {
  console.error("FAIL: base comissão duplicada no resumo, count", baseComissaoCount);
  process.exit(1);
}
if (labelsPosNeg.includes("Negativo recebido") || labelsPosNeg.includes("Pago")) {
  console.error("FAIL: resumo não deveria repetir negativo recebido/pago, got", labelsPosNeg);
  process.exit(1);
}
if (!labelsPosNeg.includes("Recebido hoje") || !labelsPosNeg.includes("Falta receber (operação)")) {
  console.error("FAIL: resumo deveria ter recebido hoje e falta operação, got", labelsPosNeg);
  process.exit(1);
}
const linhaRecebido = linhasPosNeg.find((l) => l.label === "Recebido hoje");
if (!linhaRecebido?.hint?.includes("falta operação")) {
  console.error("FAIL: hint do pagamento deveria citar operação pendente, got", linhaRecebido?.hint);
  process.exit(1);
}

console.log("\n✓ Verificação OK");
