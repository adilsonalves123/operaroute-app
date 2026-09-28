import { describe, expect, it } from "vitest";
import { valorSaidaPermitidaNoCaixa } from "./saldo-caixa";

describe("valorSaidaPermitidaNoCaixa", () => {
  it("não deixa sair mais do que tem no caixa", () => {
    expect(valorSaidaPermitidaNoCaixa(500, 1000)).toBe(500);
    expect(valorSaidaPermitidaNoCaixa(500, 300)).toBe(300);
    expect(valorSaidaPermitidaNoCaixa(100, 100)).toBe(100);
  });

  it("caixa zerado ou negativo não libera saída", () => {
    expect(valorSaidaPermitidaNoCaixa(0, 100)).toBe(0);
    expect(valorSaidaPermitidaNoCaixa(-200, 100)).toBe(0);
  });
});
