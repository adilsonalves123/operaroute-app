import { calcularColetaFuraFura } from "../src/lib/nichos/fura-fura/calculo-coleta";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = calcularColetaFuraFura({
  quantidadeFuros: 100,
  precoFuro: 1,
  comissaoPercentual: 30,
  desconto: 0,
  brindes: [{ nome: "Urso", quantidade: 2, custo_unitario: 5 }],
  valorPagoRecebido: 50,
});

assert(base.valorBruto === 100, "bruto 100");
assert(base.valorComissao === 30, "comissao 30");
assert(base.valorAReceber === 70, "a receber 70");
assert(base.custoBrindes === 10, "brindes 10");
assert(base.lucroReal === 60, "lucro 60");
assert(base.saldoPendente === 20, "pendente 20");
assert(!base.quitado, "nao quitado");

const quitado = calcularColetaFuraFura({
  quantidadeFuros: 50,
  precoFuro: 2,
  comissaoPercentual: 20,
  desconto: 5,
  brindes: [],
  valorPagoRecebido: 75,
});

assert(quitado.valorBruto === 100, "bruto 50*2");
assert(quitado.valorAReceber === 75, "a receber 75");
assert(quitado.quitado, "quitado");

console.log("OK — calculo fura-fura");
