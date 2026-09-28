import { describe, expect, it } from "vitest";
import {
  depoimentosPublicos,
  iniciais,
  MAX_DEPOIMENTOS,
  normalizarProvaSocial,
  resolverVideo,
} from "./prova-social";

describe("resolverVideo", () => {
  it("aceita os formatos de link do YouTube", () => {
    const esperado = {
      tipo: "embed",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    };
    expect(resolverVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(esperado);
    expect(resolverVideo("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(esperado);
    expect(resolverVideo("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual(esperado);
    expect(resolverVideo("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual(esperado);
  });

  it("aceita Vimeo e arquivo mp4", () => {
    expect(resolverVideo("https://vimeo.com/123456789")).toEqual({
      tipo: "embed",
      src: "https://player.vimeo.com/video/123456789",
    });
    expect(resolverVideo("https://x.supabase.co/storage/v1/object/public/a/demo.mp4")).toEqual({
      tipo: "arquivo",
      src: "https://x.supabase.co/storage/v1/object/public/a/demo.mp4",
    });
  });

  it("recusa http, javascript e sites desconhecidos", () => {
    expect(resolverVideo("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(resolverVideo("javascript:alert(1)")).toBeNull();
    expect(resolverVideo("https://exemplo.com/pagina")).toBeNull();
    expect(resolverVideo("")).toBeNull();
    expect(resolverVideo(null)).toBeNull();
  });
});

describe("normalizarProvaSocial", () => {
  it("valor ausente ou inválido vira vazio", () => {
    expect(normalizarProvaSocial(null)).toEqual({
      video_url: null,
      video_titulo: "",
      depoimentos: [],
    });
    expect(normalizarProvaSocial("x").depoimentos).toEqual([]);
  });

  it("descarta link de vídeo não suportado", () => {
    expect(normalizarProvaSocial({ video_url: "https://exemplo.com" }).video_url).toBeNull();
  });

  it("limpa depoimentos: corta texto, tira foto sem https e remove vazios", () => {
    const prova = normalizarProvaSocial({
      depoimentos: [
        { nome: "  Ana  ", texto: "x".repeat(600), foto_url: "http://inseguro.com/a.jpg" },
        { nome: "", texto: "" },
        { nome: "Bruno", texto: "Bom", ativo: false },
      ],
    });
    expect(prova.depoimentos).toHaveLength(2);
    expect(prova.depoimentos[0]!.nome).toBe("Ana");
    expect(prova.depoimentos[0]!.texto).toHaveLength(400);
    expect(prova.depoimentos[0]!.foto_url).toBeNull();
    expect(prova.depoimentos[1]!.ativo).toBe(false);
  });

  it("limita a quantidade", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({ nome: `N${i}`, texto: "t" }));
    expect(normalizarProvaSocial({ depoimentos: muitos }).depoimentos).toHaveLength(
      MAX_DEPOIMENTOS
    );
  });
});

describe("depoimentosPublicos", () => {
  it("só mostra os ativos com nome e texto", () => {
    const prova = normalizarProvaSocial({
      depoimentos: [
        { nome: "Ana", texto: "Ótimo" },
        { nome: "Bruno", texto: "Bom", ativo: false },
        { nome: "Carla", texto: "" },
      ],
    });
    expect(depoimentosPublicos(prova).map((d) => d.nome)).toEqual(["Ana"]);
  });
});

describe("iniciais", () => {
  it("pega primeira e última letra do nome", () => {
    expect(iniciais("Ana Maria Souza")).toBe("AS");
    expect(iniciais("bruno")).toBe("B");
    expect(iniciais("  ")).toBe("?");
  });
});
