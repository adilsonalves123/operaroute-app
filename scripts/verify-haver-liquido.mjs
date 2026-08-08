import assert from "node:assert/strict";
import { liquidoRecebidoCassinoVisita } from "../src/lib/nichos/cassino/lucro-recebido.ts";
import { cobravelCassinoVisita } from "../src/lib/visitas-ponto/resumo.ts";

// Haver 248 + op 280 + sem pagamento → líquido 0 (não 248)
assert.equal(
  liquidoRecebidoCassinoVisita({
    valor_operacao_efetivo: 280,
    valor_pago: 0,
    restante: 32,
    total_lucro_centavos: 50000,
  }),
  0
);

// Cash 70 quitado
assert.equal(
  liquidoRecebidoCassinoVisita({
    valor_operacao_efetivo: 70,
    valor_pago: 70,
    restante: 0,
    total_lucro_centavos: 10000,
  }),
  70
);

// Negativo com valor deixado (sai do líquido)
assert.equal(
  liquidoRecebidoCassinoVisita({
    saldo_negativo: true,
    total_lucro_centavos: -100000,
    desconto: 1000,
  }),
  -1000
);

// Negativo sem deixar dinheiro (ex.: só haver) → 0
assert.equal(
  liquidoRecebidoCassinoVisita({
    saldo_negativo: true,
    total_lucro_centavos: -100000,
    desconto: 0,
  }),
  0
);

// Dashboard fantasma 318 = 70 + 248; com a correção fica 70
assert.equal(
  70 +
    liquidoRecebidoCassinoVisita({
      valor_operacao_efetivo: 280,
      valor_pago: 0,
      restante: 32,
      total_lucro_centavos: 50000,
    }),
  70
);

// Cobravel pós-haver
assert.equal(
  cobravelCassinoVisita({
    valor_operacao_efetivo: 280,
    valor_pago: 0,
    restante: 32,
  }),
  32
);

// Incluir dívida: restante alto sem debito_abatido não infla cobravel da visita
assert.equal(
  cobravelCassinoVisita({
    valor_operacao_efetivo: 105,
    valor_pago: 0,
    restante: 1345,
  }),
  105
);

// Negativo quitado por lucro + cliente não pagou: op 560 + negativo 700 = 1260
assert.equal(
  cobravelCassinoVisita({
    valor_operacao_efetivo: 560,
    valor_pago: 0,
    restante: 1260,
    debito_abatido: 700,
  }),
  1260
);

// Write-off: pendência abatida no negativo não conta como recebido
assert.equal(
  liquidoRecebidoCassinoVisita({
    valor_operacao_efetivo: 700,
    valor_pago: 0,
    restante: 0,
    total_lucro_centavos: 100000,
  }),
  0
);

console.log("ok haver/liquido/cobravel");
