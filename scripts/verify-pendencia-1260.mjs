import assert from "node:assert/strict";
import { calcularVisitaCassino } from "../src/lib/nichos/cassino/calculo-visita.ts";
import { cobravelCassinoVisita } from "../src/lib/visitas-ponto/resumo.ts";

// Cenário Pikiri: negativo 700, haver 300, lucro 1500, comissão 30%, sem pagar
const c = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "M",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 150_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [{ id: "n1", valor: 700, observacao: null }],
  pendenciasHaver: [{ id: "h1", valor: 300, observacao: null }],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  descontarHaverNaCobranca: false,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

assert.equal(c.valorOperacaoReais, 560);
assert.equal(c.totalACobrarReais, 1260);
assert.equal(c.restanteOperacaoReais, 1260);
assert.equal(c.recuperacaoNegativoReais, 700);

const cobravel = cobravelCassinoVisita({
  valor_operacao_efetivo: c.valorOperacaoEfetivoReais,
  valor_pago: c.valorPagoReais,
  restante: c.restanteReais,
  debito_abatido: c.recuperacaoNegativoReais,
});
assert.equal(cobravel, 1260, `cobravel deveria ser 1260, got ${cobravel}`);

// Sem debito_abatido ainda cortaria (legado / select incompleto)
assert.equal(
  cobravelCassinoVisita({
    valor_operacao_efetivo: 560,
    valor_pago: 0,
    restante: 1260,
  }),
  560
);

console.log("ok pendencia 1260 (negativo quitado + não pago)");
