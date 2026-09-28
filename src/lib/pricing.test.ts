import { describe, expect, it } from "vitest";
import {
  arredondarReais,
  calcPrecoAnual,
  calcPrecoCiclo,
  calcPrecoMensal,
  beneficiosExtrasPadrao,
  fatorPrecoPorNichos,
  getNichoPlanoStatus,
  getPlanoByFaixa,
  montarBeneficiosPlano,
  NICHOS_PAGOS,
  normalizarBeneficiosExtras,
  normalizarPesosNichos,
  normalizeFaixaPontos,
  PESO_PRECO_NICHOS,
  planoIncluiIa,
  planoMinimoParaNichos,
  PLANOS_PADRAO,
  reaisParaCentavos,
  type PlanoDefinicao,
} from "./pricing";
import type { Nicho } from "./types/database";

function subconjuntos<T>(itens: T[]): T[][] {
  return itens.reduce<T[][]>((acc, item) => acc.concat(acc.map((s) => [...s, item])), [[]]);
}

describe("arredondamento de centavos", () => {
  it("arredonda meio centavo para cima mesmo com ruído de ponto flutuante", () => {
    expect(259.9 * 0.85).toBeLessThan(220.915);
    expect(arredondarReais(259.9 * 0.85)).toBe(220.92);
    expect(arredondarReais(499 * 0.825)).toBe(411.68);
    expect(arredondarReais(99.9 * 0.65)).toBe(64.94);
  });

  it("converte reais em centavos inteiros sem perder 1 centavo", () => {
    expect(reaisParaCentavos(220.92)).toBe(22092);
    expect(reaisParaCentavos(0.29)).toBe(29);
    expect(reaisParaCentavos(1.005)).toBe(101);
    expect(reaisParaCentavos(4990)).toBe(499000);
  });
});

describe("fatorPrecoPorNichos", () => {
  it("sem nicho pago cobra o preço cheio", () => {
    expect(fatorPrecoPorNichos([])).toBe(1);
    expect(fatorPrecoPorNichos(null)).toBe(1);
    expect(fatorPrecoPorNichos(["outro" as Nicho])).toBe(1);
  });

  it("usa o peso de cada nicho e a média quando há vários", () => {
    expect(fatorPrecoPorNichos(["maquinas_cassino"])).toBe(1);
    expect(fatorPrecoPorNichos(["fura_fura"])).toBe(0.65);
    expect(fatorPrecoPorNichos(["maquinas_cassino", "fura_fura"])).toBe(0.825);
    expect(fatorPrecoPorNichos(["bolinha", "fura_fura", "consignado"])).toBe(0.717);
  });

  it("ignora nichos que não são pagos na média", () => {
    expect(fatorPrecoPorNichos(["fura_fura", "outro" as Nicho])).toBe(0.65);
  });

  it("nunca passa do preço cheio nem chega a zero", () => {
    for (const combo of subconjuntos(NICHOS_PAGOS)) {
      const fator = fatorPrecoPorNichos(combo);
      expect(fator).toBeGreaterThan(0);
      expect(fator).toBeLessThanOrEqual(1);
    }
  });
});

describe("preço mensal e anual", () => {
  it("preço cheio por plano com cassino", () => {
    expect(calcPrecoMensal("1-10", ["maquinas_cassino"])).toBe(99.9);
    expect(calcPrecoMensal("11-50", ["maquinas_cassino"])).toBe(259.9);
    expect(calcPrecoMensal("51-100", ["maquinas_cassino"])).toBe(499);
    expect(calcPrecoMensal("100+", ["maquinas_cassino"])).toBe(799);
  });

  it("fura-fura sai mais barato conforme o peso", () => {
    expect(calcPrecoMensal("51-100", ["fura_fura"])).toBe(324.35);
    expect(calcPrecoMensal("11-50", ["diversao"])).toBe(220.92);
  });

  it("anual = mensal × 10 por padrão, ou o multiplicador do painel", () => {
    expect(calcPrecoAnual("51-100", ["maquinas_cassino"])).toBe(4990);
    expect(calcPrecoAnual("11-50", ["diversao"])).toBe(2209.2);
    expect(calcPrecoAnual("51-100", ["maquinas_cassino"], PLANOS_PADRAO, 11)).toBe(5489);
    expect(calcPrecoCiclo("anual", "1-10", ["fura_fura"])).toBe(649.4);
    expect(calcPrecoCiclo("mensal", "1-10", ["fura_fura"])).toBe(64.94);
  });

  it("todas as combinações dão valor positivo, com no máximo 2 casas e centavos exatos", () => {
    for (const plano of PLANOS_PADRAO) {
      for (const combo of subconjuntos(NICHOS_PAGOS).filter((c) => c.length > 0)) {
        for (const ciclo of ["mensal", "anual"] as const) {
          const valor = calcPrecoCiclo(ciclo, plano.id, combo)!;
          expect(valor).toBeGreaterThan(0);
          expect(Number.isInteger(reaisParaCentavos(valor))).toBe(true);
          expect(reaisParaCentavos(valor) / 100).toBe(valor);
        }
        expect(calcPrecoMensal(plano.id, combo)!).toBeLessThanOrEqual(plano.precoMensal);
      }
    }
  });

  it("usa os preços salvos no painel do dono em vez dos padrões", () => {
    const planos: PlanoDefinicao[] = PLANOS_PADRAO.map((p) =>
      p.id === "51-100" ? { ...p, precoMensal: 549.9 } : p
    );
    expect(calcPrecoMensal("51-100", ["maquinas_cassino"], planos)).toBe(549.9);
    expect(calcPrecoMensal("51-100", ["fura_fura"], planos)).toBe(357.44);
  });

  it("preço inválido no catálogo não vira cobrança", () => {
    const planos = PLANOS_PADRAO.map((p) => ({ ...p, precoMensal: Number.NaN }));
    expect(calcPrecoMensal("1-10", ["maquinas_cassino"], planos)).toBeNull();
    expect(calcPrecoAnual("1-10", ["maquinas_cassino"], planos)).toBeNull();
  });
});

describe("faixas e limites de plano", () => {
  it("faixas antigas caem no plano atual equivalente", () => {
    expect(normalizeFaixaPontos("11-30")).toBe("11-50");
    expect(normalizeFaixaPontos("31-60")).toBe("51-100");
    expect(normalizeFaixaPontos("50+")).toBe("51-100");
    expect(normalizeFaixaPontos(null)).toBe("1-10");
    expect(normalizeFaixaPontos("lixo")).toBe("1-10");
    expect(getPlanoByFaixa("61-100").slug).toBe("pro");
  });

  it("vagas de nicho respeitam o plano", () => {
    expect(getNichoPlanoStatus(["maquinas_cassino"], "1-10")).toEqual({
      nichosPagosAtivos: 1,
      maxNichosPagos: 1,
      podeAdicionarNicho: false,
      vagasRestantes: 0,
    });
    expect(getNichoPlanoStatus(["fura_fura"], "11-50").vagasRestantes).toBe(2);
  });

  it("plano mínimo para a quantidade de nichos", () => {
    expect(planoMinimoParaNichos(1).slug).toBe("start");
    expect(planoMinimoParaNichos(2).slug).toBe("growth");
    expect(planoMinimoParaNichos(4).slug).toBe("pro");
    expect(planoMinimoParaNichos(99).maxNichos).toBe(6);
  });

  it("IA só em Pro/Elite (ou plano de R$ 499+)", () => {
    const [start, growth, pro, elite] = PLANOS_PADRAO;
    expect(planoIncluiIa(start!)).toBe(false);
    expect(planoIncluiIa(growth!)).toBe(false);
    expect(planoIncluiIa(pro!)).toBe(true);
    expect(planoIncluiIa(elite!)).toBe(true);
    expect(planoIncluiIa({ ...pro!, incluiIa: false })).toBe(true);
    expect(planoIncluiIa({ ...growth!, precoMensal: 499 })).toBe(true);
  });
});

describe("pesos dos nichos editáveis", () => {
  it("sem nada salvo, usa os pesos padrão", () => {
    expect(normalizarPesosNichos(null)).toEqual(PESO_PRECO_NICHOS);
    expect(normalizarPesosNichos([0.5])).toEqual(PESO_PRECO_NICHOS);
  });

  it("completa nichos faltando e ignora chaves desconhecidas", () => {
    const pesos = normalizarPesosNichos({ fura_fura: 0.5, inventado: 0.2 });
    expect(pesos.fura_fura).toBe(0.5);
    expect(pesos.maquinas_cassino).toBe(1);
    expect(pesos).not.toHaveProperty("inventado");
  });

  it("prende o peso entre 10% e 100% do plano", () => {
    const pesos = normalizarPesosNichos({ fura_fura: 0, bolinha: 3, ursinho: "abc" });
    expect(pesos.fura_fura).toBe(0.1);
    expect(pesos.bolinha).toBe(1);
    expect(pesos.ursinho).toBe(0.9);
  });

  it("o preço cobrado segue o peso salvo", () => {
    const pesos = normalizarPesosNichos({ fura_fura: 0.5 });
    expect(fatorPrecoPorNichos(["fura_fura"], pesos)).toBe(0.5);
    expect(calcPrecoMensal("11-50", ["fura_fura"], PLANOS_PADRAO, pesos)).toBe(129.95);
    expect(calcPrecoAnual("11-50", ["fura_fura"], PLANOS_PADRAO, 10, pesos)).toBe(1299.5);
    expect(calcPrecoCiclo("mensal", "11-50", ["fura_fura", "maquinas_cassino"], PLANOS_PADRAO, 10, pesos)).toBe(194.93);
  });
});

describe("benefícios editáveis", () => {
  const start = PLANOS_PADRAO.find((p) => p.slug === "start")!;

  it("sem personalização, repete o texto padrão", () => {
    expect(montarBeneficiosPlano(start)).toEqual([
      "Até 10 pontos",
      "Até 10 equipamentos",
      "Até 1 nicho na rota",
      ...beneficiosExtrasPadrao(start),
    ]);
  });

  it("linhas do dono substituem só o texto livre; limites continuam automáticos", () => {
    const itens = montarBeneficiosPlano({
      ...start,
      limitePontos: 20,
      beneficiosExtras: ["Suporte no WhatsApp", "  ", "Relatório mensal"],
    });
    expect(itens).toEqual([
      "Até 20 pontos",
      "Até 20 equipamentos",
      "Até 1 nicho na rota",
      "Suporte no WhatsApp",
      "Relatório mensal",
    ]);
  });

  it("limpa linhas vazias, corta texto longo e limita a quantidade", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => `Item ${i}`);
    expect(normalizarBeneficiosExtras(muitas)).toHaveLength(8);
    expect(normalizarBeneficiosExtras(["x".repeat(200)])[0]).toHaveLength(120);
    expect(normalizarBeneficiosExtras("não é lista")).toEqual([]);
  });
});
