import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { iaDisponivel } from "@/lib/ia/openai-client";
import {
  lerNumeroDaFoto,
  type ModoLeituraNumeroFoto,
} from "@/lib/ia/ler-numero-foto";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BYTES = 8 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  const tipo = (file.type || "image/jpeg").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const b64 = buffer.toString("base64");
  const mime = tipo === "image/png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

function parseContexto(raw: FormDataEntryValue | null): "entrada" | "saida" | null {
  const value = String(raw ?? "").trim();
  if (value === "entrada" || value === "saida") return value;
  return null;
}

function parseModo(raw: FormDataEntryValue | null): ModoLeituraNumeroFoto {
  const value = String(raw ?? "").trim();
  if (value === "moeda" || value === "texto") return value;
  return "contador";
}

export async function POST(request: Request) {
  const authColetas = await requireAcesso("coletas", "criar");
  const auth =
    authColetas.ok
      ? authColetas
      : await requireAcesso("pontos", "editar");
  if (!auth.ok) return auth.response;

  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "Leitura por foto indisponível (IA não configurada)." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const foto = form.get("foto");
  if (!(foto instanceof File) || foto.size <= 0) {
    return NextResponse.json({ error: "Envie uma foto." }, { status: 400 });
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Foto muito grande (máx. 8 MB). Aproxime mais ou tire outra." },
      { status: 400 }
    );
  }

  const tipo = (foto.type || "image/jpeg").toLowerCase();
  if (!tipo.startsWith("image/")) {
    return NextResponse.json({ error: "Arquivo precisa ser uma imagem." }, { status: 400 });
  }

  const modo = parseModo(form.get("modo"));
  const contexto = parseContexto(form.get("contexto"));
  const rapido = String(form.get("rapido") ?? "").trim() === "1";
  const imageDataUrl = await fileToDataUrl(foto);
  const leitura = await lerNumeroDaFoto({ imageDataUrl, modo, contexto, rapido });

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.message }, { status: 422 });
  }

  return NextResponse.json({
    numero_raw: leitura.result.numeroRaw,
    numero: leitura.result.numeroFormatado,
    confianca: leitura.result.confianca,
    rotulo: leitura.result.rotulo,
    modelo: leitura.result.modelo,
  });
}
