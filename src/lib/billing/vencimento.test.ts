import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  diasCalendarioAte,
  statusVencimento,
  textoDiasVencimento,
} from "./vencimento";

describe("diasCalendarioAte (calendário de Brasília)", () => {
  const agora = new Date("2026-09-28T15:00:00Z"); // 12:00 em Brasília

  it("conta dias de calendário, não blocos de 24h", () => {
    expect(diasCalendarioAte("2026-09-28T23:00:00Z", agora)).toBe(0);
    expect(diasCalendarioAte("2026-09-29T02:59:00Z", agora)).toBe(0); // 23:59 BRT
    expect(diasCalendarioAte("2026-09-29T03:00:00Z", agora)).toBe(1); // 00:00 BRT do dia 29
    expect(diasCalendarioAte("2026-10-01T12:00:00Z", agora)).toBe(3);
    expect(diasCalendarioAte("2026-09-27T12:00:00Z", agora)).toBe(-1);
  });

  it("vazio ou inválido devolve null", () => {
    expect(diasCalendarioAte(null, agora)).toBeNull();
    expect(diasCalendarioAte("xyz", agora)).toBeNull();
  });
});

describe("statusVencimento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("longe do vencimento não avisa", () => {
    expect(statusVencimento({ assinatura_vence_em: "2026-10-20T12:00:00Z" })).toEqual({
      tipo: "ok",
    });
  });

  it("dentro de 5 dias avisa com os dias restantes", () => {
    expect(statusVencimento({ assinatura_vence_em: "2026-10-01T12:00:00Z" })).toMatchObject({
      tipo: "vence_em_breve",
      dias: 3,
      renovacaoCancelada: false,
    });
  });

  it("marca quando a renovação foi cancelada", () => {
    expect(
      statusVencimento({ assinatura_vence_em: "2026-10-01T12:00:00Z", assinatura_ativa: false })
    ).toMatchObject({ tipo: "vence_em_breve", renovacaoCancelada: true });
  });

  it("depois do vencimento (e da tolerância) fica vencida", () => {
    expect(statusVencimento({ assinatura_vence_em: "2026-09-20T12:00:00Z" })).toMatchObject({
      tipo: "vencida",
    });
  });

  it("nunca pagou: sem aviso de vencimento", () => {
    expect(statusVencimento({ assinatura_vence_em: null })).toEqual({ tipo: "ok" });
  });
});

describe("textoDiasVencimento", () => {
  it("texto amigável", () => {
    expect(textoDiasVencimento(0)).toBe("vence hoje");
    expect(textoDiasVencimento(1)).toBe("vence amanhã");
    expect(textoDiasVencimento(3)).toBe("vence em 3 dias");
  });
});
