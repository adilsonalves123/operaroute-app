import { describe, expect, it } from "vitest";
import {
  formulariosDosNichos,
  nichoDoEquipamento,
  paginasDoCampo,
  pontoDoDestino,
} from "@/lib/offline/campo-rotas";

const ID = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

describe("campo-rotas", () => {
  it("um formulário por nicho, ursinho e vending juntos", () => {
    expect(
      formulariosDosNichos(["maquinas_cassino", "ursinho", "vending_ursinho", "outros"]).map((f) => f.rota)
    ).toEqual(["/coletas/nova/cassino", "/coletas/nova/ursinho"]);
  });

  it("telas guardadas no preparo", () => {
    expect(paginasDoCampo(["bolinha"])).toEqual(["/campo-offline", "/pontos", "/coletas/nova/bolinha"]);
  });

  it("tipo de máquina vira nicho", () => {
    expect(nichoDoEquipamento("sinuca")).toBe("diversao");
    expect(nichoDoEquipamento("cassino")).toBe("maquinas_cassino");
    expect(nichoDoEquipamento("desconhecido")).toBeNull();
    expect(nichoDoEquipamento(null)).toBeNull();
  });

  it("descobre o ponto da tela que não estava guardada", () => {
    expect(pontoDoDestino(`/pontos/${ID}`)).toBe(ID);
    expect(pontoDoDestino(`/coletas/nova?ponto=${ID.toUpperCase()}`)).toBe(ID);
    expect(pontoDoDestino("/dashboard")).toBeNull();
    expect(pontoDoDestino("/pontos/novo")).toBeNull();
    expect(pontoDoDestino(null)).toBeNull();
  });
});
