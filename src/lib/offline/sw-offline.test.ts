import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Consulta = {
  tabela: string;
  colunas: string[] | null;
  filtros: { coluna: string; op: string; negar: boolean; valor: string | string[] }[];
  ordem: { coluna: string; desc: boolean; nullsFirst: boolean }[];
  limite: number | null;
  offset: number;
  objeto: boolean;
};

type Retrato = {
  linhas: Record<string, unknown>[];
  escopo: { obrigatorios?: Record<string, string>; chaves?: string[] } | null;
};

type Resultado = { ok: false } | { ok: true; dados: Record<string, unknown>[]; total: number; inicio: number };

type ApiCampo = {
  interpretarConsultaRest: (url: string, accept?: string | null) => Consulta | null;
  avaliarConsulta: (consulta: Consulta, retrato: Retrato) => Resultado;
  montarRespostaRest: (
    consulta: Consulta,
    resultado: Extract<Resultado, { ok: true }>
  ) => { status: number; headers: Record<string, string>; corpo: string };
  paginaDeCampo: (pathname: string) => boolean;
  ehFormularioColeta: (pathname: string) => boolean;
  htmlIndependeDaBusca: (pathname: string) => boolean;
};

function carregarApi(): ApiCampo {
  const codigo = readFileSync(join(process.cwd(), "public", "sw-offline.js"), "utf8");
  const self: Record<string, unknown> = {};
  runInNewContext(codigo, { self, URL });
  return self.OperaRouteCampo as ApiCampo;
}

const api = carregarApi();
const BASE = "https://abc.supabase.co/rest/v1";

function consultar(caminho: string, retrato: Retrato, accept?: string) {
  const consulta = api.interpretarConsultaRest(`${BASE}/${caminho}`, accept);
  if (!consulta) return null;
  return api.avaliarConsulta(consulta, retrato);
}

function dados(r: Resultado | null) {
  if (!r || !r.ok) throw new Error("consulta não respondida");
  return r.dados;
}

const equipamentos: Retrato = {
  escopo: null,
  linhas: [
    { id: "e1", ponto_id: "p1", tipo: "cassino", status: "ativo", nome: "Máquina B", entrada_atual: 150 },
    { id: "e2", ponto_id: "p1", tipo: "cassino", status: "ativo", nome: "máquina a", entrada_atual: null },
    { id: "e3", ponto_id: "p1", tipo: "bolinha", status: "ativo", nome: "Bolinha", entrada_atual: 10 },
    { id: "e4", ponto_id: "p1", tipo: "cassino", status: "retirado", nome: "Velha", entrada_atual: 3 },
    { id: "e5", ponto_id: "p2", tipo: "cassino", status: "ativo", nome: "Outra", entrada_atual: 7 },
  ],
};

const pendencias: Retrato = {
  escopo: { obrigatorios: { status: "aberta" } },
  linhas: [
    { id: "d1", ponto_id: "p1", status: "aberta", tipo: "Negativo", valor: 50, titulo: "x", descricao: null },
    { id: "d2", ponto_id: "p1", status: "aberta", tipo: "haver", valor: 20, titulo: "y", descricao: null },
    { id: "d3", ponto_id: "p1", status: "aberta", tipo: "parcial", valor: 30, titulo: "z", descricao: null },
    { id: "d4", ponto_id: "p2", status: "aberta", tipo: "visita_consolidada", valor: 10, titulo: "w", descricao: null },
  ],
};

describe("sw-offline: leitura das consultas do Supabase", () => {
  it("entende select, filtros, ordem e limite como o postgrest-js monta", () => {
    const c = api.interpretarConsultaRest(
      `${BASE}/equipamentos?select=id,nome&ponto_id=eq.p1&tipo=in.(cassino,"a,b")&foto_url=not.is.null&order=nome.desc.nullslast&limit=5&offset=2`,
      "application/json"
    );
    expect(c).not.toBeNull();
    expect(c!.tabela).toBe("equipamentos");
    expect(c!.colunas).toEqual(["id", "nome"]);
    expect(c!.filtros).toEqual([
      { coluna: "ponto_id", op: "eq", negar: false, valor: "p1" },
      { coluna: "tipo", op: "in", negar: false, valor: ["cassino", "a,b"] },
      { coluna: "foto_url", op: "is", negar: true, valor: "null" },
    ]);
    expect(c!.ordem).toEqual([{ coluna: "nome", desc: true, nullsFirst: false }]);
    expect(c!.limite).toBe(5);
    expect(c!.offset).toBe(2);
    expect(c!.objeto).toBe(false);
  });

  it("recusa o que não sabe repetir (or, relacionamento, JSON, rpc)", () => {
    expect(api.interpretarConsultaRest(`${BASE}/pontos?or=(a.eq.1,b.eq.2)`)).toBeNull();
    expect(api.interpretarConsultaRest(`${BASE}/pontos?select=*,equipamentos(id)`)).toBeNull();
    expect(api.interpretarConsultaRest(`${BASE}/pontos?select=nome:apelido`)).toBeNull();
    expect(api.interpretarConsultaRest(`${BASE}/pontos?dados->>x=eq.1`)).toBeNull();
    expect(api.interpretarConsultaRest(`${BASE}/rpc/qualquer`)).toBeNull();
    expect(api.interpretarConsultaRest(`${BASE}/pontos?nome=fts.bar`)).toBeNull();
  });

  it("marca .single() pelo Accept", () => {
    const c = api.interpretarConsultaRest(`${BASE}/pontos?id=eq.p1`, "application/vnd.pgrst.object+json");
    expect(c!.objeto).toBe(true);
  });
});

describe("sw-offline: resposta com os dados da rota", () => {
  it("máquinas ativas de um tipo no ponto, em ordem de nome (formulário de coleta)", () => {
    const r = consultar("equipamentos?select=*&ponto_id=eq.p1&tipo=eq.cassino&status=eq.ativo&order=nome.asc", equipamentos);
    expect(dados(r).map((e) => e.id)).toEqual(["e2", "e1"]);
  });

  it("ilike sem curinga = igual sem diferenciar maiúsculas", () => {
    const r = consultar("pendencias?select=id,valor&ponto_id=eq.p1&status=eq.aberta&tipo=ilike.negativo", pendencias);
    expect(dados(r)).toEqual([{ id: "d1", valor: 50 }]);
  });

  it("in com a lista de tipos de pendência de operação", () => {
    const r = consultar(
      "pendencias?select=id&ponto_id=eq.p1&status=eq.aberta&tipo=in.(pagamento_pendente,parcial,visita_consolidada)",
      pendencias
    );
    expect(dados(r)).toEqual([{ id: "d3" }]);
  });

  it("não responde pendências sem o filtro usado no download (poderia faltar resolvida)", () => {
    expect(consultar("pendencias?select=id&ponto_id=eq.p1", pendencias)).toEqual({ ok: false });
  });

  it("perfil só responde consultas pelo próprio usuário", () => {
    const perfis: Retrato = {
      escopo: { chaves: ["user_id"] },
      linhas: [{ id: "x", user_id: "u1", empresa_id: "emp1", onboarding_completo: true }],
    };
    expect(dados(consultar("profiles?select=empresa_id,onboarding_completo&user_id=eq.u1", perfis))).toEqual([
      { empresa_id: "emp1", onboarding_completo: true },
    ]);
    expect(consultar("profiles?select=id&empresa_id=eq.emp1", perfis)).toEqual({ ok: false });
  });

  it("não inventa coluna que não foi baixada", () => {
    const fin: Retrato = { escopo: null, linhas: [{ tipo: "entrada", valor: 10 }] };
    expect(dados(consultar("financeiro?select=tipo,valor&empresa_id=eq.emp1", { ...fin, linhas: fin.linhas.map((l) => ({ ...l, empresa_id: "emp1" })) }))).toEqual([
      { tipo: "entrada", valor: 10 },
    ]);
    expect(consultar("financeiro?select=tipo,valor,descricao&empresa_id=eq.emp1", fin)).toEqual({ ok: false });
  });

  it("is.null, not.is.null, números e nulls na ordenação", () => {
    expect(dados(consultar("equipamentos?select=id&entrada_atual=is.null", equipamentos))).toEqual([{ id: "e2" }]);
    expect(dados(consultar("equipamentos?select=id&ponto_id=eq.p1&entrada_atual=gte.10&order=entrada_atual.desc", equipamentos))).toEqual([
      { id: "e1" },
      { id: "e3" },
    ]);
    const asc = dados(consultar("equipamentos?select=id&ponto_id=eq.p1&order=entrada_atual.asc", equipamentos));
    expect(asc[asc.length - 1]).toEqual({ id: "e2" });
    const desc = dados(consultar("equipamentos?select=id&ponto_id=eq.p1&order=entrada_atual.desc", equipamentos));
    expect(desc[0]).toEqual({ id: "e2" });
  });

  it("neq não traz nulos (como no Postgres)", () => {
    const r = consultar("equipamentos?select=id&entrada_atual=neq.150", equipamentos);
    expect(dados(r).map((e) => e.id)).toEqual(["e3", "e4", "e5"]);
  });

  it("maybeSingle/single e content-range", () => {
    const um = api.interpretarConsultaRest(`${BASE}/equipamentos?select=*&id=eq.e3`, "application/vnd.pgrst.object+json")!;
    const r1 = api.avaliarConsulta(um, equipamentos);
    if (!r1.ok) throw new Error("esperava resposta");
    const resp1 = api.montarRespostaRest(um, r1);
    expect(resp1.status).toBe(200);
    expect(JSON.parse(resp1.corpo).id).toBe("e3");

    const nenhum = api.interpretarConsultaRest(`${BASE}/equipamentos?select=*&id=eq.zz`, "application/vnd.pgrst.object+json")!;
    const r2 = api.avaliarConsulta(nenhum, equipamentos);
    if (!r2.ok) throw new Error("esperava resposta");
    expect(api.montarRespostaRest(nenhum, r2).status).toBe(406);

    const lista = api.interpretarConsultaRest(`${BASE}/equipamentos?select=id&ponto_id=eq.p1&limit=2`)!;
    const r3 = api.avaliarConsulta(lista, equipamentos);
    if (!r3.ok) throw new Error("esperava resposta");
    const resp3 = api.montarRespostaRest(lista, r3);
    expect(JSON.parse(resp3.corpo)).toHaveLength(2);
    expect(resp3.headers["content-range"]).toBe("0-1/4");
  });

  it("datas com fuso diferente comparam pelo instante", () => {
    const col: Retrato = { escopo: null, linhas: [{ id: "c1", created_at: "2026-09-28T12:00:00+00:00" }] };
    expect(dados(consultar("coletas?select=id&created_at=gte.2026-09-28T11:00:00.000Z", col))).toEqual([{ id: "c1" }]);
    expect(dados(consultar("coletas?select=id&created_at=gt.2026-09-28T12:00:00.000Z", col))).toEqual([]);
  });
});

describe("sw-offline: quais telas entram no modo campo", () => {
  it("telas do app sim; login, dono, api e arquivos não", () => {
    expect(api.paginaDeCampo("/pontos")).toBe(true);
    expect(api.paginaDeCampo("/pontos/abc")).toBe(true);
    expect(api.paginaDeCampo("/coletas/nova/cassino")).toBe(true);
    expect(api.paginaDeCampo("/campo-offline")).toBe(true);
    expect(api.paginaDeCampo("/login")).toBe(false);
    expect(api.paginaDeCampo("/dono/planos")).toBe(false);
    expect(api.paginaDeCampo("/api/pontos")).toBe(false);
    expect(api.paginaDeCampo("/auth/signout")).toBe(false);
    expect(api.paginaDeCampo("/c/abc")).toBe(false);
    expect(api.paginaDeCampo("/coletas")).toBe(true);
    expect(api.paginaDeCampo("/sw-push.js")).toBe(false);
  });

  it("formulário de coleta e modo campo reaproveitam o HTML de qualquer ponto", () => {
    expect(api.ehFormularioColeta("/coletas/nova/fura-fura")).toBe(true);
    expect(api.ehFormularioColeta("/coletas/nova")).toBe(false);
    expect(api.ehFormularioColeta("/coletas/cassino/abc")).toBe(false);
    expect(api.htmlIndependeDaBusca("/campo-offline")).toBe(true);
    expect(api.htmlIndependeDaBusca("/coletas/nova/cassino")).toBe(true);
    // /coletas/nova monta os links com o ponto no servidor — não pode trocar de ponto.
    expect(api.htmlIndependeDaBusca("/coletas/nova")).toBe(false);
    expect(api.htmlIndependeDaBusca("/pontos/abc")).toBe(false);
  });
});
