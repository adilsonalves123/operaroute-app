import { describe, expect, it } from "vitest";
import {
  coletadoEmDoEnvio,
  diferencasLidas,
  lerEnvioOffline,
  previstoCobranca,
  UUID_RE,
} from "./envio-offline";

const agora = new Date("2026-09-28T15:00:00.000Z");
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString();

describe("lerEnvioOffline", () => {
  it("ignora corpo sem envio_offline", () => {
    expect(lerEnvioOffline({ ponto_id: "x" })).toBeNull();
    expect(lerEnvioOffline(null)).toBeNull();
    expect(lerEnvioOffline({ envio_offline: { coletado_em: 123 } })).toBeNull();
  });

  it("mantém só números válidos em previsto", () => {
    const r = lerEnvioOffline({
      envio_offline: {
        coletado_em: minutosAtras(30),
        ponto_nome: "Bar do Zé",
        previsto: { divida_ponto: "12.5", haver: 3, lixo: "abc" },
      },
    });
    expect(r?.ponto_nome).toBe("Bar do Zé");
    expect(r?.previsto).toEqual({ divida_ponto: 12.5, haver: 3 });
  });
});

describe("coletadoEmDoEnvio", () => {
  const corpo = (coletado_em: string) => ({ envio_offline: { coletado_em } });

  it("usa a hora da coleta quando veio da fila", () => {
    const d = coletadoEmDoEnvio(corpo(minutosAtras(90)), agora);
    expect(d?.toISOString()).toBe(minutosAtras(90));
  });

  it("menos de 2 minutos é agora (null)", () => {
    expect(coletadoEmDoEnvio(corpo(minutosAtras(1)), agora)).toBeNull();
  });

  it("recusa data no futuro (relógio do celular adiantado)", () => {
    expect(coletadoEmDoEnvio(corpo(minutosAtras(-60)), agora)).toBeNull();
  });

  it("recusa mais de 7 dias", () => {
    expect(coletadoEmDoEnvio(corpo(minutosAtras(7 * 24 * 60 + 1)), agora)).toBeNull();
    expect(coletadoEmDoEnvio(corpo(minutosAtras(7 * 24 * 60 - 1)), agora)).not.toBeNull();
  });

  it("data inválida ou sem envio_offline = null", () => {
    expect(coletadoEmDoEnvio(corpo("ontem"), agora)).toBeNull();
    expect(coletadoEmDoEnvio({}, agora)).toBeNull();
  });
});

describe("diferencasLidas", () => {
  it("sem previsto ou lido não há o que conferir", () => {
    expect(diferencasLidas(undefined, { haver: 1 })).toEqual([]);
    expect(diferencasLidas({ haver: 1 }, undefined)).toEqual([]);
  });

  it("valores iguais (ou 1 centavo de arredondamento) passam", () => {
    expect(
      diferencasLidas({ divida_ponto: 100, haver: 20.01 }, { divida_ponto: 100, haver: 20 })
    ).toEqual([]);
  });

  it("aponta dívida que mudou até o envio", () => {
    expect(diferencasLidas({ divida_ponto: 100 }, { divida_ponto: 150.5 })).toEqual([
      "Dívida do ponto: R$ 100,00 na coleta, R$ 150,50 no envio",
    ]);
  });

  it("aponta contador anterior diferente (outra coleta no meio)", () => {
    const m = diferencasLidas(
      { "contador:eq1:entrada": 1000, "contador:eq1:saida": 500 },
      { "contador:eq1:entrada": 1200, "contador:eq1:saida": 500 }
    );
    expect(m).toEqual(["Contador anterior: 1000 na coleta, 1200 no envio"]);
  });

  it("chave que o servidor não leu é ignorada", () => {
    expect(diferencasLidas({ haver: 10 }, { divida_ponto: 5 })).toEqual([]);
  });
});

describe("previstoCobranca", () => {
  it("sem cobrar agora não confere nada", () => {
    expect(
      previstoCobranca({ cobrandoAgora: false, dividaPonto: 50, descontarHaver: true, haverSaldo: 10 })
    ).toEqual({});
  });

  it("haver só entra quando desconta haver", () => {
    expect(
      previstoCobranca({ cobrandoAgora: true, dividaPonto: 50, descontarHaver: false, haverSaldo: 10 })
    ).toEqual({ divida_ponto: 50 });
    expect(
      previstoCobranca({ cobrandoAgora: true, dividaPonto: 50, descontarHaver: true, haverSaldo: 10 })
    ).toEqual({ divida_ponto: 50, haver: 10 });
  });
});

describe("UUID_RE", () => {
  it("aceita UUID v4 e recusa lixo", () => {
    expect(UUID_RE.test("3f2b8c1e-9a4d-4c7b-8e2f-1a2b3c4d5e6f")).toBe(true);
    expect(UUID_RE.test("abc")).toBe(false);
  });
});
