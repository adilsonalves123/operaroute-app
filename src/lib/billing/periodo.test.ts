import { describe, expect, it } from "vitest";
import { calcNovoVencimento, calcVencimentoAssinatura, somarMeses } from "./periodo";

const d = (iso: string) => new Date(iso);

describe("calcVencimentoAssinatura", () => {
  it("mensal soma 1 mês no mesmo dia e horário", () => {
    expect(calcVencimentoAssinatura("mensal", d("2026-09-15T13:00:00Z")).toISOString()).toBe(
      "2026-10-15T13:00:00.000Z"
    );
  });

  it("não transborda no fim do mês", () => {
    expect(calcVencimentoAssinatura("mensal", d("2026-01-31T13:00:00Z")).toISOString()).toBe(
      "2026-02-28T13:00:00.000Z"
    );
    expect(calcVencimentoAssinatura("mensal", d("2028-01-31T13:00:00Z")).toISOString()).toBe(
      "2028-02-29T13:00:00.000Z"
    );
    expect(calcVencimentoAssinatura("mensal", d("2026-03-31T13:00:00Z")).toISOString()).toBe(
      "2026-04-30T13:00:00.000Z"
    );
  });

  it("dezembro vira janeiro do ano seguinte", () => {
    expect(calcVencimentoAssinatura("mensal", d("2026-12-31T13:00:00Z")).toISOString()).toBe(
      "2027-01-31T13:00:00.000Z"
    );
  });

  it("anual soma 12 meses; 29/02 vira 28/02", () => {
    expect(calcVencimentoAssinatura("anual", d("2026-09-15T13:00:00Z")).toISOString()).toBe(
      "2027-09-15T13:00:00.000Z"
    );
    expect(calcVencimentoAssinatura("anual", d("2028-02-29T13:00:00Z")).toISOString()).toBe(
      "2029-02-28T13:00:00.000Z"
    );
  });

  it("não altera a data recebida", () => {
    const from = d("2026-01-31T13:00:00Z");
    calcVencimentoAssinatura("mensal", from);
    expect(from.toISOString()).toBe("2026-01-31T13:00:00.000Z");
  });

  it("somarMeses aceita vários meses (cortesia do painel)", () => {
    expect(somarMeses(d("2026-08-31T12:00:00Z"), 6).toISOString()).toBe(
      "2027-02-28T12:00:00.000Z"
    );
  });
});

describe("calcNovoVencimento", () => {
  const agora = d("2026-09-28T15:00:00Z");

  it("primeira compra conta a partir de agora", () => {
    expect(calcNovoVencimento("mensal", null, agora).toISOString()).toBe(
      "2026-10-28T15:00:00.000Z"
    );
  });

  it("renovação antecipada soma ao vencimento atual (cliente não perde dias)", () => {
    expect(calcNovoVencimento("mensal", "2026-10-05T12:00:00Z", agora).toISOString()).toBe(
      "2026-11-05T12:00:00.000Z"
    );
    expect(calcNovoVencimento("anual", "2026-10-05T12:00:00Z", agora).toISOString()).toBe(
      "2027-10-05T12:00:00.000Z"
    );
  });

  it("assinatura vencida recomeça de agora (não cobra o período parado)", () => {
    expect(calcNovoVencimento("mensal", "2026-08-01T12:00:00Z", agora).toISOString()).toBe(
      "2026-10-28T15:00:00.000Z"
    );
  });

  it("data inválida no banco é tratada como sem vencimento", () => {
    expect(calcNovoVencimento("mensal", "não é data", agora).toISOString()).toBe(
      "2026-10-28T15:00:00.000Z"
    );
  });
});
