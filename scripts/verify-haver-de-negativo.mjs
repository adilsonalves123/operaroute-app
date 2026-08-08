import assert from "node:assert/strict";
import { calcularVisitaCassino } from "../src/lib/nichos/cassino/calculo-visita.ts";
import {
  isHaverDeNegativoCliente,
  isHaverCreditoComum,
} from "../src/lib/nichos/cassino/pendencias.ts";

assert.equal(
  isHaverDeNegativoCliente({ titulo: "Cliente pagou ganhadores" }),
  true
);
assert.equal(
  isHaverCreditoComum({
    titulo: "Haver do cliente",
    descricao: "Pagamento a mais (troco/crédito)",
  }),
  true
);

// Lucro 1000, haver de negativo 700, comissão 30% → base 300 → comissão 90, op 210
const c = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "M",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 100_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [],
  pendenciasHaver: [
    {
      id: "h-neg",
      valor: 700,
      titulo: "Cliente pagou ganhadores",
      observacao: "Ponto pagou ganhadores na visita negativa",
    },
  ],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  descontarHaverNaCobranca: false,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

assert.equal(c.haverDeNegativoTotalReais, 700);
assert.equal(c.recuperacaoHaverDeNegativoReais, 700);
assert.equal(c.valorClienteReais, 90);
assert.equal(c.valorOperacaoReais, 210);
assert.equal(c.totalACobrarReais, 210);
assert.equal(c.haverRestanteReais, 0);
assert.ok(c.abatimentosHaver.every((a) => a.resolvida));

// Cenário tela: negativo 700 + haver ganhadores 300 + lucro 1500 → receber 1050
const pikiri = calcularVisitaCassino({
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
  pendenciasHaver: [
    {
      id: "h-neg",
      valor: 300,
      titulo: "Cliente pagou ganhadores",
      observacao: "Ponto pagou ganhadores na visita negativa",
    },
  ],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  descontarHaverNaCobranca: false,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

assert.equal(pikiri.valorClienteReais, 150);
assert.equal(pikiri.valorOperacaoReais, 350);
assert.equal(pikiri.totalACobrarReais, 1050);
assert.equal(pikiri.haverRestanteReais, 0);

// Troco/crédito NÃO bloqueia comissão
const troco = calcularVisitaCassino({
  leituras: [
    {
      equipamentoId: "m1",
      nome: "M",
      entradaAnterior: 0,
      saidaAnterior: 0,
      entradaAtual: 100_000,
      saidaAtual: 0,
    },
  ],
  pendenciasNegativas: [],
  pendenciasHaver: [
    {
      id: "h-troco",
      valor: 10,
      titulo: "Haver do cliente",
      descricao: "Pagamento a mais (troco/crédito)",
    },
  ],
  comissaoPercentual: 30,
  descontoManualReais: 0,
  descontoRecebimentoReais: 0,
  abaterAutomatico: true,
  descontarHaverNaCobranca: false,
  valorPixReais: 0,
  valorDinheiroReais: 0,
});

assert.equal(troco.haverDeNegativoTotalReais, 0);
assert.equal(troco.recuperacaoHaverDeNegativoReais, 0);
assert.equal(troco.valorClienteReais, 300);
assert.equal(troco.valorOperacaoReais, 700);

console.log("ok haver-de-negativo comissão + classificação");
