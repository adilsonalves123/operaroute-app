import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  diasRestantesTrial,
  estaEmTrial,
  temAcessoOperacao,
  temPagamentoValido,
  trialExpirado,
  trialFimEfetivo,
} from "./assinatura-acesso";

const AGORA = new Date("2026-09-28T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});
afterEach(() => vi.useRealTimers());

describe("pagamento válido", () => {
  it("vencimento futuro libera", () => {
    expect(temPagamentoValido({ assinatura_vence_em: "2026-10-28T15:00:00Z" })).toBe(true);
  });

  it("tolerância de até 1 dia depois de vencer", () => {
    expect(temPagamentoValido({ assinatura_vence_em: "2026-09-28T03:00:00Z" })).toBe(true);
    expect(temPagamentoValido({ assinatura_vence_em: "2026-09-26T15:00:00Z" })).toBe(false);
  });

  it("não confia só na flag assinatura_ativa", () => {
    expect(temPagamentoValido({ assinatura_ativa: true, assinatura_vence_em: null })).toBe(false);
  });
});

describe("trial", () => {
  it("usa trial_fim quando gravado", () => {
    const p = { trial_fim: "2026-10-01T15:00:00Z" };
    expect(estaEmTrial(p)).toBe(true);
    expect(diasRestantesTrial(p.trial_fim)).toBe(3);
  });

  it("sem trial_fim, infere 7 dias a partir do cadastro", () => {
    const p = { empresa_created_at: "2026-09-25T15:00:00Z" };
    expect(trialFimEfetivo(p)?.toISOString()).toBe("2026-10-02T15:00:00.000Z");
    expect(estaEmTrial(p)).toBe(true);
  });

  it("trial acabado sem pagamento bloqueia a operação", () => {
    const p = { trial_fim: "2026-09-27T15:00:00Z" };
    expect(trialExpirado(p)).toBe(true);
    expect(temAcessoOperacao(p)).toBe(false);
    expect(diasRestantesTrial(p.trial_fim)).toBe(0);
  });

  it("pagamento válido encerra o trial mesmo com trial_fim no futuro", () => {
    const p = { trial_fim: "2026-10-01T15:00:00Z", assinatura_vence_em: "2026-10-28T15:00:00Z" };
    expect(estaEmTrial(p)).toBe(false);
    expect(temAcessoOperacao(p)).toBe(true);
  });
});
