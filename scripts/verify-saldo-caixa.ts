import assert from "node:assert/strict";
import { valorSaidaPermitidaNoCaixa } from "../src/lib/financeiro/saldo-caixa";

assert.equal(valorSaidaPermitidaNoCaixa(500, 1000), 500);
assert.equal(valorSaidaPermitidaNoCaixa(500, 300), 300);
assert.equal(valorSaidaPermitidaNoCaixa(0, 100), 0);
assert.equal(valorSaidaPermitidaNoCaixa(-200, 100), 0);
assert.equal(valorSaidaPermitidaNoCaixa(100, 100), 100);

console.log("✓ saldo-caixa OK");
