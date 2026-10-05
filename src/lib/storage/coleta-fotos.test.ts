import { describe, expect, it } from "vitest";
import { arquivoParaUpload } from "@/lib/storage/coleta-fotos";

describe("arquivoParaUpload", () => {
  it("dá nome ao blob da fila para o storage aceitar", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const arquivo = arquivoParaUpload("empresa/fotos_coleta/visita/maq.jpg", blob);
    expect(arquivo).not.toBeNull();
    expect(arquivo?.name).toBe("maq.jpg");
    expect(arquivo?.size).toBe(3);
    expect(arquivo?.type).toBe("image/jpeg");
  });

  it("foto vazia não vira arquivo", () => {
    const vazio = new Blob([]);
    expect(arquivoParaUpload("empresa/fotos_coleta/visita/maq.jpg", vazio)).toBeNull();
  });
});
