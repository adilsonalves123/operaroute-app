import { describe, expect, it } from "vitest";
import {
  getLimiteEquipamentos,
  limiteEhIlimitado,
  mensagemLimiteEquipamentos,
  podeAdicionarEquipamentos,
} from "./limite-equipamentos-regras";

describe("getLimiteEquipamentos", () => {
  it("usa o limite gravado na empresa quando existe", () => {
    expect(getLimiteEquipamentos("1-10", 25)).toBe(25);
  });

  it("cai para o limite da faixa quando a empresa não tem limite", () => {
    expect(getLimiteEquipamentos("1-10", null)).toBe(10);
    expect(getLimiteEquipamentos("11-50", 0)).toBe(50);
  });
});

describe("podeAdicionarEquipamentos", () => {
  it("permite até encostar no limite", () => {
    expect(podeAdicionarEquipamentos(9, 1, 10)).toBe(true);
    expect(podeAdicionarEquipamentos(10, 1, 10)).toBe(false);
  });

  it("considera o lote inteiro de uma vez", () => {
    expect(podeAdicionarEquipamentos(7, 3, 10)).toBe(true);
    expect(podeAdicionarEquipamentos(8, 3, 10)).toBe(false);
  });

  it("nunca bloqueia quando não há nada a adicionar", () => {
    expect(podeAdicionarEquipamentos(15, 0, 10)).toBe(true);
  });

  it("plano ilimitado não bloqueia", () => {
    expect(limiteEhIlimitado(9999)).toBe(true);
    expect(podeAdicionarEquipamentos(50_000, 10, 9999)).toBe(true);
  });

  it("quem já passou do limite não adiciona mais", () => {
    expect(podeAdicionarEquipamentos(12, 1, 10)).toBe(false);
  });
});

describe("mensagemLimiteEquipamentos", () => {
  it("mostra uso atual e manda para Planos", () => {
    const msg = mensagemLimiteEquipamentos(10, 1, 10);
    expect(msg).toContain("10 de 10");
    expect(msg).toContain("Planos");
  });

  it("explica quantos ainda cabem quando o lote é maior que as vagas", () => {
    expect(mensagemLimiteEquipamentos(8, 3, 10)).toContain("Cabem mais 2");
  });
});
