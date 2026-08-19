import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { iaDisponivel } from "@/lib/ia/openai-client";
import { lerContadoresCassinoDaFoto } from "@/lib/nichos/cassino/ler-contadores-ia";

export const runtime = "nodejs";
/** Vision pode demorar. */
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function parseAnterior(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export async function POST(request: Request) {
  const auth = await requireAcesso("coletas", "criar");
  if (!auth.ok) return auth.response;

  if (!iaDisponivel()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada neste ambiente." },
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
    return NextResponse.json({ error: "Envie a foto do painel." }, { status: 400 });
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Foto muito grande (máx. 8 MB). Tire de novo mais perto." },
      { status: 400 }
    );
  }

  const tipo = (foto.type || "image/jpeg").toLowerCase();
  if (!tipo.startsWith("image/")) {
    return NextResponse.json({ error: "Arquivo precisa ser uma imagem." }, { status: 400 });
  }

  const entradaAnterior = parseAnterior(form.get("entrada_anterior"));
  const saidaAnterior = parseAnterior(form.get("saida_anterior"));

  const buffer = Buffer.from(await foto.arrayBuffer());
  const b64 = buffer.toString("base64");
  const mime = tipo === "image/png" ? "image/png" : "image/jpeg";
  const imageDataUrl = `data:${mime};base64,${b64}`;

  const leitura = await lerContadoresCassinoDaFoto({
    imageDataUrl,
    entradaAnterior,
    saidaAnterior,
  });

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.message }, { status: 502 });
  }

  const r = leitura.result;
  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(auth.supabase, auth.profile, {
    request,
    acao: "ler_ia_cassino",
    tabela: "coletas_ia_cassino",
    severidade:
      r.status === "approved_ai"
        ? "info"
        : r.status === "needs_review"
          ? "medium"
          : "high",
    categoria: r.flags.length > 0 ? "anomalia" : "coleta",
    modulo: "coletas",
    titulo: "Leitura IA de contadores de cassino",
    resumo: r.aplicar
      ? `Leitura aplicada com score ${r.score}/100.`
      : `Leitura recusada para aplicação automática com score ${r.score}/100.`,
    dadosNovos: {
      entrada_anterior: entradaAnterior,
      saida_anterior: saidaAnterior,
      entrada_centesimos: r.entradaCentesimos,
      saida_centesimos: r.saidaCentesimos,
      entrada_formatada: r.entradaFormatada,
      saida_formatada: r.saidaFormatada,
      aplicar: r.aplicar,
      confianca: r.confianca,
      score: r.score,
      status: r.status,
      flags: r.flags,
      avisos: r.avisos,
      motivo_recusa: r.motivoRecusa ?? null,
      modelos: r.modelosUsados,
      divergencia_digitos: r.divergenciaDigitos ?? null,
    },
    meta: {
      arquivo_nome: foto.name || null,
      arquivo_tipo: tipo,
      arquivo_tamanho: foto.size,
    },
  });

  return NextResponse.json({
    aplicar: r.aplicar,
    entrada: r.entradaFormatada,
    saida: r.saidaFormatada,
    entrada_centesimos: r.entradaCentesimos,
    saida_centesimos: r.saidaCentesimos,
    confianca: r.confianca,
    score: r.score,
    status: r.status,
    flags: r.flags,
    avisos: r.avisos,
    motivo_recusa: r.motivoRecusa ?? null,
    modelo: r.modelo,
    modelos: r.modelosUsados,
    divergencia_digitos: r.divergenciaDigitos ?? null,
    /** Sempre true nesta feature — UI obriga confirmação antes de marcar pronta. */
    exige_confirmacao: true,
  });
}
