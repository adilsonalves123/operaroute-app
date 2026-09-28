import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  isAdminConfigured: () => false,
}));
vi.mock("@/lib/supabase/app-bootstrap", () => ({ getAppBootstrap: vi.fn() }));
vi.mock("@/lib/assinatura-owner", () => ({ resolverOwnerProfileAcesso: vi.fn() }));

const { calcularAcessoIa } = await import("./acesso-ia");
const { PLANOS_PADRAO } = await import("@/lib/pricing");

const pago = { assinatura_vence_em: "2026-10-28T15:00:00Z" };
const trial = { trial_fim: "2026-10-01T15:00:00Z" };
const expirado = { trial_fim: "2026-09-20T15:00:00Z" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("calcularAcessoIa", () => {
  it("Pro e Elite pagos têm IA", () => {
    expect(calcularAcessoIa("51-100", pago, PLANOS_PADRAO)).toMatchObject({ liberada: true, motivo: "plano" });
    expect(calcularAcessoIa("100+", pago, PLANOS_PADRAO)).toMatchObject({ liberada: true, motivo: "plano" });
  });

  it("Start e Growth pagos não têm IA", () => {
    const r = calcularAcessoIa("11-50", pago, PLANOS_PADRAO);
    expect(r).toMatchObject({ liberada: false, motivo: "bloqueada", planoAtual: "Growth" });
    expect(r.planosComIa).toBe("Pro e Elite");
    expect(calcularAcessoIa("1-10", pago, PLANOS_PADRAO).liberada).toBe(false);
  });

  it("teste grátis libera a IA em qualquer faixa", () => {
    expect(calcularAcessoIa("1-10", trial, PLANOS_PADRAO)).toMatchObject({ liberada: true, motivo: "trial" });
  });

  it("trial acabado e sem pagamento bloqueia até no Elite", () => {
    expect(calcularAcessoIa("100+", expirado, PLANOS_PADRAO).liberada).toBe(false);
  });
});
