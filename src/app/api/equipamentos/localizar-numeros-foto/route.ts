import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { iaDisponivel } from "@/lib/ia/openai-client";
import { localizarNumerosNaFoto } from "@/lib/ia/localizar-numeros-foto";

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

export async function POST(request: Request) {
  const authColetas = await requireAcesso("coletas", "criar");
  const auth = authColetas.ok ? authColetas : await requireAcesso("pontos", "editar");
  if (!auth.ok) return auth.response;

  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "Detecção de números indisponível (IA não configurada)." },
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
    return NextResponse.json({ error: "Foto muito grande (máx. 8 MB)." }, { status: 400 });
  }

  const imageDataUrl = await fileToDataUrl(foto);
  const resultado = await localizarNumerosNaFoto(imageDataUrl);

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.message }, { status: 422 });
  }

  return NextResponse.json({
    numeros: resultado.numeros.map((n) => ({
      id: n.id,
      numero_raw: n.numeroRaw,
      numero: n.numeroFormatado,
      rotulo: n.rotulo,
      tipo: n.tipo,
      box: n.box,
      confianca: n.confianca,
    })),
  });
}
