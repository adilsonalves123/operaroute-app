import { describe, expect, it } from "vitest";
import {
  buildResumoFinanceiroLinhas,
  calcularVisitaCassino,
  comissaoBloqueada,
  hintAdiantamento,
  valorSaidaCaixaAdiantamento,
} from "@/lib/nichos/cassino";
import { parseMoneyInput } from "@/lib/utils";

type Input = Parameters<typeof calcularVisitaCassino>[0];

/** Mesma tolerância dos scripts antigos: 2 centavos. */
function reais(atual: number | undefined, esperado: number) {
  expect(Math.abs((atual ?? Number.NaN) - esperado)).toBeLessThanOrEqual(0.02);
}

function maquina(
  entradaAnterior: number,
  saidaAnterior: number,
  entradaAtual: number,
  saidaAtual: number,
  id = "m1"
) {
  return { equipamentoId: id, nome: "Máquina", entradaAnterior, saidaAnterior, entradaAtual, saidaAtual };
}

function visita(parcial: Partial<Input> & Pick<Input, "leituras">) {
  return calcularVisitaCassino({
    pendenciasNegativas: [],
    comissaoPercentual: 30,
    descontoManualReais: 0,
    descontoRecebimentoReais: 0,
    abaterAutomatico: true,
    ...parcial,
  });
}

describe("parseMoneyInput", () => {
  it.each([
    ["690", 690],
    ["690,00", 690],
    ["1.000,00", 1000],
    ["1.234,56", 1234.56],
  ])("%s → %d", (raw, esperado) => {
    reais(parseMoneyInput(raw), esperado);
  });
});

describe("visita positiva com negativo anterior", () => {
  const negativo770 = [{ id: "p1", valor: 770, observacao: null }];

  it("lucro 900 quita negativo 770; comissão 30% só sobre os 130", () => {
    const r = visita({
      leituras: [maquina(0, 0, 90_000, 0)],
      pendenciasNegativas: negativo770,
      valorPixReais: 0,
      valorDinheiroReais: 0,
    });
    reais(r.recuperacaoNegativoReais, 770);
    reais(r.debitoAbatidoReais, 0);
    reais(r.debitoRestanteReais, 0);
    reais(r.saldoAposDebitoReais, 130);
    reais(r.valorClienteReais, 39);
    reais(r.valorOperacaoReais, 91);
    reais(r.totalACobrarReais, 861);
    reais(r.restanteOperacaoReais, 861);
    reais(r.restanteReais, 861);
    expect(r.comissaoAplicada).toBe(true);
    expect(comissaoBloqueada(r)).toBe(false);
  });

  it("pagamento integral de 861 não deixa nada em aberto", () => {
    const r = visita({
      leituras: [maquina(0, 0, 90_000, 0)],
      pendenciasNegativas: negativo770,
      valorPixReais: 861,
      valorDinheiroReais: 0,
    });
    reais(r.debitoAbatidoReais, 0);
    reais(r.restanteReais, 0);
  });

  it("lucro menor que o negativo: grava abatimento parcial e bloqueia comissão", () => {
    const r = visita({
      leituras: [maquina(0, 0, 50_000, 0)],
      pendenciasNegativas: [{ id: "p2", valor: 770, observacao: null }],
      valorPixReais: 0,
      valorDinheiroReais: 0,
    });
    reais(r.recuperacaoNegativoReais, 500);
    reais(r.debitoAbatidoReais, 0);
    reais(r.debitoRestanteReais, 270);
    expect(r.abatimentos).toHaveLength(1);
    reais(r.abatimentos[0]?.valorAbatidoReais, 500);
    reais(r.valorClienteReais, 0);
    expect(comissaoBloqueada(r)).toBe(true);
  });

  it("2 máquinas, lucro 2000, débito 100, pagou 280", () => {
    const r = visita({
      leituras: [
        maquina(1_000_000, 800_000, 1_300_000, 950_000, "m1"),
        maquina(500_000, 400_000, 700_000, 550_000, "m2"),
      ],
      pendenciasNegativas: [{ id: "p3", valor: 100, observacao: null }],
      valorPixReais: 280,
      valorDinheiroReais: 0,
    });
    expect(r.totalLucroCentavos).toBe(200_000);
    reais(r.valorOperacaoReais, 1330);
    reais(r.debitoAbatidoReais, 0);
    reais(r.restanteOperacaoReais, 1150);
  });

  it("lucro 1200 cobre negativo 1200; pagou 1000 → 200 vira dívida da operação", () => {
    const r = visita({
      leituras: [maquina(0, 0, 120_000, 0)],
      pendenciasNegativas: [{ id: "neg-1200", valor: 1200, observacao: null }],
      valorPixReais: 1000,
      valorDinheiroReais: 0,
    });
    reais(r.recuperacaoNegativoReais, 1200);
    reais(r.debitoRestanteReais, 0);
    reais(r.restanteOperacaoReais, 200);
    expect(r.abatimentos.every((a) => a.resolvida)).toBe(true);
  });

  it("lucro 2800, negativo 1400, pagou só o negativo → falta 980 da operação", () => {
    const r = visita({
      leituras: [maquina(0, 0, 500_000, 220_000)],
      pendenciasNegativas: [{ id: "neg1400", valor: 1400, observacao: null }],
      valorPixReais: 1400,
      valorDinheiroReais: 0,
    });
    reais(r.recuperacaoNegativoReais, 1400);
    reais(r.restanteOperacaoReais, 980);
    reais(r.restanteReais, 980);

    const labels = buildResumoFinanceiroLinhas(r, 30)
      .filter((l) => !l.secao)
      .map((l) => l.label);
    expect(labels.filter((l) => l === "Base para comissão")).toHaveLength(1);
    expect(labels).not.toContain("Negativo recebido");
    expect(labels).not.toContain("Pago");
    expect(labels).toContain("Recebido hoje");
    expect(labels).toContain("Falta receber (operação)");
    const recebido = buildResumoFinanceiroLinhas(r, 30).find((l) => l.label === "Recebido hoje");
    expect(recebido?.hint?.toLowerCase()).toContain("opera");
  });

  it("desconto manual é ignorado com negativo aberto em visita positiva", () => {
    const base = {
      leituras: [maquina(0, 0, 100_000, 0, "m3")],
      pendenciasNegativas: [{ id: "p4", valor: 1800, observacao: null }],
      descontoManualReais: 300,
    };
    const semPagamento = visita({ ...base, valorPixReais: 0, valorDinheiroReais: 0 });
    reais(semPagamento.recuperacaoNegativoReais, 1000);
    reais(semPagamento.descontoManualReais, 0);

    const parcial = visita({ ...base, valorPixReais: 500, valorDinheiroReais: 0 });
    reais(parcial.debitoAbatidoReais, 500);
    reais(parcial.debitoRestanteReais, 1300);
  });
});

describe("visita negativa", () => {
  const prejuizo300 = [maquina(100_000, 0, 100_000, 70_000, "m-neg")];

  it("valor deixado pelo operador vira negativo a recuperar", () => {
    const r = visita({ leituras: prejuizo300, descontoManualReais: 700, valorPixReais: 0, valorDinheiroReais: 0 });
    expect(r.saldoNegativo).toBe(true);
    reais(r.novoDebitoReais, 700);
    expect(r.clientePagouGanhadores).toBe(false);
  });

  it("cliente pagou os ganhadores: gera haver, sem negativo", () => {
    const r = visita({ leituras: prejuizo300 });
    expect(r.clientePagouGanhadores).toBe(true);
    reais(r.haverGeradoReais, 700);
    reais(r.novoDebitoReais, 0);
  });

  const prejuizo1200 = [maquina(100_000, 100_000, 100_000, 220_000, "m-np")];

  it("prejuízo 1200 com pendência de operação 1000 paga → saldo −200", () => {
    const r = visita({
      leituras: prejuizo1200,
      pendenciasOperacao: [{ id: "po1", valor: 1000, observacao: null }],
      abaterPendenciaOperacaoNegativa: false,
      valorPixReais: 1000,
      valorDinheiroReais: 0,
    });
    reais(r.pendenciaOperacaoAbatidaReais, 1000);
    reais(r.haverGeradoReais, 1200);
    reais(r.saldoLiquidoReais, -200);
  });

  it("deixou 200 de 1200 → negativo 200 + haver 1000", () => {
    const r = visita({ leituras: prejuizo1200, descontoManualReais: 200 });
    reais(r.novoDebitoReais, 200);
    reais(r.haverGeradoReais, 1000);
  });

  it("usar haver existente cobre o prejuízo de 200", () => {
    const r = visita({
      leituras: [maquina(100_000, 100_000, 100_000, 120_000, "m-nh")],
      pendenciasHaver: [{ id: "h-neg", valor: 1000, observacao: null }],
      incluirUsarHaverNegativo: true,
    });
    reais(r.haverCompensadoReais, 200);
    reais(r.haverGeradoReais, 0);
  });

  it("prejuízo 1000, abate 400 de dívida, repõe 600 → negativo 1000", () => {
    const r = visita({
      leituras: [maquina(100_000, 100_000, 100_000, 200_000, "m-ab")],
      pendenciasOperacao: [{ id: "po-ab", valor: 400, observacao: null }],
      abaterPendenciaOperacaoNegativa: true,
      descontoManualReais: 600,
    });
    reais(r.pendenciaOperacaoAbatidaReais, 400);
    reais(r.valorDeixadoOperadorReais, 600);
    reais(r.novoDebitoReais, 1000);
    reais(r.haverGeradoReais, 0);
  });

  it("abate 200 de operação e repõe 1000 (prejuízo 1200)", () => {
    const r = visita({
      leituras: [maquina(60_000, 0, 60_000, 120_000, "m-pul-n")],
      pendenciasOperacao: [{ id: "po-pul-200", valor: 200, observacao: null }],
      abaterPendenciaOperacaoNegativa: true,
      descontoManualReais: 1000,
    });
    reais(r.pendenciaOperacaoAbatidaReais, 200);
    expect(r.abatimentosPendenciaOperacao).toHaveLength(1);
    expect(r.abatimentosPendenciaOperacao[0]?.resolvida).toBe(true);
    reais(r.haverGeradoReais, 0);
    reais(r.novoDebitoReais, 1200);
  });

  it("deixou 2000 sem leitura + visita −1000 → recebe 1000 do ponto", () => {
    const base = {
      leituras: [maquina(100_000, 100_000, 100_000, 200_000, "m-sem-leitura")],
      pendenciasOperacao: [{ id: "po-2k", valor: 2000, observacao: null }],
      abaterPendenciaOperacaoNegativa: true,
      valorDinheiroReais: 0,
    };
    const semPagar = visita({ ...base, valorPixReais: 0 });
    reais(semPagar.pendenciaOperacaoAbatidaReais, 1000);
    reais(semPagar.saldoLiquidoReais, 1000);
    reais(semPagar.novoDebitoReais, 0);

    const pago = visita({ ...base, valorPixReais: 1000 });
    reais(pago.pendenciaOperacaoAbatidaReais, 2000);
    reais(pago.pendenciaOperacaoRestanteReais, 0);
    reais(pago.valorPagoReais, 1000);
  });

  it("mandou 500 sem leitura + visita −50 → devolve 450, sem comissão", () => {
    const r = visita({
      leituras: [maquina(100_000, 100_000, 100_000, 105_000, "m-500")],
      pendenciasNegativas: [{ id: "sl-500", valor: 500, titulo: "Mandou sem leitura", tipo: "negativo" }],
      pendenciasOperacao: [],
      abaterPendenciaOperacaoNegativa: true,
      valorPixReais: 0,
      valorDinheiroReais: 0,
    });
    expect(r.comissaoAplicada).toBe(false);
    reais(r.debitoAbatidoReais, 50);
    reais(r.debitoRestanteReais, 450);
    reais(r.saldoLiquidoReais, 450);
    reais(r.novoDebitoReais, 0);
  });

  it("mandou 500 sem leitura + visita +600 → comissão só nos 100; cobra 570", () => {
    const r = visita({
      leituras: [maquina(100_000, 100_000, 160_000, 100_000, "m-600")],
      pendenciasNegativas: [{ id: "sl-500b", valor: 500, titulo: "Mandou sem leitura", tipo: "negativo" }],
      pendenciasOperacao: [],
      valorPixReais: 0,
      valorDinheiroReais: 0,
    });
    reais(r.recuperacaoNegativoReais, 500);
    reais(r.valorClienteReais, 30);
    reais(r.valorOperacaoReais, 70);
    reais(r.totalACobrarReais, 570);
  });
});

describe("haver do ponto", () => {
  const lucro900 = [maquina(0, 0, 90_000, 0, "m-h")];
  const haver1000 = [{ id: "h1", valor: 1000, observacao: null }];

  it("haver 1000, lucro 900: comissão no lucro cheio e haver compensa a operação", () => {
    const r = visita({ leituras: lucro900, pendenciasHaver: haver1000, descontarHaverNaCobranca: true });
    reais(r.valorClienteReais, 270);
    reais(r.valorOperacaoReais, 630);
    reais(r.haverCompensadoReais, 630);
    reais(r.totalACobrarReais, 0);
    reais(r.haverRestanteReais, 370);
  });

  it("lucro 300, haver 200 descontado → cobra 10", () => {
    const r = visita({
      leituras: [maquina(0, 0, 50_000, 20_000, "m-hp")],
      pendenciasHaver: [{ id: "h2", valor: 200, observacao: null }],
      descontarHaverNaCobranca: true,
    });
    reais(r.haverCompensadoReais, 200);
    reais(r.valorClienteReais, 90);
    reais(r.valorOperacaoReais, 210);
    reais(r.totalACobrarReais, 10);
  });

  it("operador quita os 370 restantes", () => {
    const r = visita({
      leituras: lucro900,
      pendenciasHaver: haver1000,
      descontarHaverNaCobranca: true,
      descontoManualReais: 370,
    });
    reais(r.haverRestanteReais, 0);
  });

  it("cliente pagou a mais: excedente vira haver novo do cliente", () => {
    const r = visita({
      leituras: lucro900,
      pendenciasHaver: haver1000,
      descontarHaverNaCobranca: true,
      valorPixReais: 100,
      valorDinheiroReais: 0,
    });
    reais(r.totalACobrarReais, 0);
    reais(r.haverQuitadoReais, 0);
    reais(r.haverReais, 100);
    reais(r.haverRestanteReais, 370);
  });

  it("excedente abate pendência anterior não incluída no total", () => {
    const r = visita({
      leituras: [maquina(0, 0, 100_000, 0, "m-op")],
      pendenciasOperacao: [{ id: "po1", valor: 300, observacao: null }],
      incluirPendenciasOperacao: false,
      valorPixReais: 1000,
      valorDinheiroReais: 0,
    });
    reais(r.totalACobrarReais, 700);
    reais(r.pendenciaOperacaoAbatidaReais, 300);
    reais(r.haverReais, 0);
  });
});

describe("adiantamento Pix/dinheiro e saída de caixa", () => {
  it("só conta na saída o que saiu do caixa", () => {
    reais(valorSaidaCaixaAdiantamento({ pixReais: 300, dinheiroReais: 0, pixDoCaixa: true, dinheiroDoCaixa: false }), 300);
    reais(valorSaidaCaixaAdiantamento({ pixReais: 0, dinheiroReais: 200, pixDoCaixa: false, dinheiroDoCaixa: false }), 0);
    reais(valorSaidaCaixaAdiantamento({ pixReais: 150, dinheiroReais: 50, pixDoCaixa: true, dinheiroDoCaixa: true }), 200);
    reais(valorSaidaCaixaAdiantamento({ pixReais: 150, dinheiroReais: 50, pixDoCaixa: true, dinheiroDoCaixa: false }), 150);
  });

  it("hint indica se saiu do caixa ou foi por fora", () => {
    expect(hintAdiantamento({ pixReais: 150, dinheiroReais: 50, pixDoCaixa: true, dinheiroDoCaixa: true })).toContain(
      "saiu do caixa"
    );
    expect(hintAdiantamento({ pixReais: 0, dinheiroReais: 80, pixDoCaixa: false, dinheiroDoCaixa: false })).toContain(
      "fora do caixa"
    );
  });

  it("negativa com adiantamento 150 Pix + 50 dinheiro de 1200", () => {
    const adiantamento = { pixReais: 150, dinheiroReais: 50, pixDoCaixa: true, dinheiroDoCaixa: true };
    const r = visita({
      leituras: [maquina(100_000, 100_000, 100_000, 220_000, "m-np")],
      descontoManualReais: 200,
    });
    reais(r.novoDebitoReais, 200);
    reais(r.haverGeradoReais, 1000);
    const linha = buildResumoFinanceiroLinhas(r, 30, adiantamento).find(
      (l) => l.label === "Você repôs no ponto"
    );
    expect(linha?.hint).toContain("Pix");
    expect(linha?.hint).toContain("saiu do caixa");
  });
});
