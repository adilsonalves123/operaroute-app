import { describe, expect, it } from "vitest";
import { calcularColetaFuraFura } from "./calculo-coleta";

describe("calcularColetaFuraFura", () => {
  it("100 furos a R$ 1, 30% comissão, brindes 10, pagou 50", () => {
    const r = calcularColetaFuraFura({
      quantidadeFuros: 100,
      precoFuro: 1,
      comissaoPercentual: 30,
      desconto: 0,
      brindes: [{ nome: "Urso", quantidade: 2, custo_unitario: 5 }],
      valorPagoRecebido: 50,
    });
    expect(r.valorBruto).toBe(100);
    expect(r.valorComissao).toBe(30);
    expect(r.valorAReceber).toBe(70);
    expect(r.custoBrindes).toBe(10);
    expect(r.lucroReal).toBe(60);
    expect(r.saldoPendente).toBe(20);
    expect(r.quitado).toBe(false);
  });

  it("desconto reduz o a receber e pagamento exato quita", () => {
    const r = calcularColetaFuraFura({
      quantidadeFuros: 50,
      precoFuro: 2,
      comissaoPercentual: 20,
      desconto: 5,
      brindes: [],
      valorPagoRecebido: 75,
    });
    expect(r.valorBruto).toBe(100);
    expect(r.valorAReceber).toBe(75);
    expect(r.quitado).toBe(true);
  });
});
