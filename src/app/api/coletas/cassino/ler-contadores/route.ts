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

async function fileToDataUrl(file: File): Promise<string> {
  const tipo = (file.type || "image/jpeg").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const b64 = buffer.toString("base64");
  const mime = tipo === "image/png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function parseEquipamentoId(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value || null;
}

function parsePontoId(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value || null;
}

type HistoricoColetaMini = {
  entrada_periodo: number | null;
  saida_periodo: number | null;
  created_at: string;
};

function media(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function analisarHistoricoMaquina(args: {
  entradaPeriodoAtual: number;
  saidaPeriodoAtual: number;
  historico: HistoricoColetaMini[];
}) {
  const entradaHist = args.historico
    .map((row) => Number(row.entrada_periodo ?? 0))
    .filter((n) => n > 0);
  const saidaHist = args.historico
    .map((row) => Number(row.saida_periodo ?? 0))
    .filter((n) => n > 0);

  if (Math.max(entradaHist.length, saidaHist.length) < 3) {
    return {
      flags: [] as string[],
      avisos: [] as string[],
      scorePenalty: 0,
      bloquearAplicacao: false,
      resumo: null as
        | {
            amostras: number;
            mediaEntrada: number;
            mediaSaida: number;
            maxEntrada: number;
            maxSaida: number;
          }
        | null,
    };
  }

  const mediaEntrada = media(entradaHist);
  const mediaSaida = media(saidaHist);
  const maxEntrada = Math.max(...entradaHist, 0);
  const maxSaida = Math.max(...saidaHist, 0);

  const thresholdEntradaAviso = Math.max(mediaEntrada * 4, maxEntrada * 2.5, 150_000);
  const thresholdSaidaAviso = Math.max(mediaSaida * 4, maxSaida * 2.5, 150_000);
  const thresholdEntradaBloqueio = Math.max(mediaEntrada * 7, maxEntrada * 4, 300_000);
  const thresholdSaidaBloqueio = Math.max(mediaSaida * 7, maxSaida * 4, 300_000);

  const flags: string[] = [];
  const avisos: string[] = [];
  let scorePenalty = 0;
  let bloquearAplicacao = false;

  if (args.entradaPeriodoAtual > thresholdEntradaAviso) {
    flags.push("historico_entrada_fora_do_padrao");
    avisos.push("Entrada do período muito acima do histórico desta máquina.");
    scorePenalty += 12;
  }
  if (args.saidaPeriodoAtual > thresholdSaidaAviso) {
    flags.push("historico_saida_fora_do_padrao");
    avisos.push("Saída do período muito acima do histórico desta máquina.");
    scorePenalty += 12;
  }
  if (args.entradaPeriodoAtual > thresholdEntradaBloqueio) {
    flags.push("historico_entrada_anomalia_severa");
    bloquearAplicacao = true;
    scorePenalty += 18;
  }
  if (args.saidaPeriodoAtual > thresholdSaidaBloqueio) {
    flags.push("historico_saida_anomalia_severa");
    bloquearAplicacao = true;
    scorePenalty += 18;
  }

  return {
    flags,
    avisos,
    scorePenalty,
    bloquearAplicacao,
    resumo: {
      amostras: Math.max(entradaHist.length, saidaHist.length),
      mediaEntrada: Math.round(mediaEntrada),
      mediaSaida: Math.round(mediaSaida),
      maxEntrada,
      maxSaida,
    },
  };
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
  const equipamentoId = parseEquipamentoId(form.get("equipamento_id"));
  const pontoId = parsePontoId(form.get("ponto_id"));
  const fotoEntrada = form.get("foto_entrada");
  const fotoSaida = form.get("foto_saida");

  const imageDataUrl = await fileToDataUrl(foto);
  const entradaCropDataUrl =
    fotoEntrada instanceof File && fotoEntrada.size > 0 ? await fileToDataUrl(fotoEntrada) : null;
  const saidaCropDataUrl =
    fotoSaida instanceof File && fotoSaida.size > 0 ? await fileToDataUrl(fotoSaida) : null;

  const leitura = await lerContadoresCassinoDaFoto({
    imageDataUrl,
    entradaAnterior,
    saidaAnterior,
    entradaCropDataUrl,
    saidaCropDataUrl,
  });

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.message }, { status: 502 });
  }

  const historico =
    equipamentoId
      ? (
          await auth.supabase
            .from("coletas")
            .select("entrada_periodo, saida_periodo, created_at")
            .eq("empresa_id", auth.profile.empresa_id)
            .eq("equipamento_id", equipamentoId)
            .order("created_at", { ascending: false })
            .limit(8)
        ).data ?? []
      : [];

  const r = leitura.result;
  const historicoAnalise = analisarHistoricoMaquina({
    entradaPeriodoAtual: Math.max(0, r.entradaCentesimos - entradaAnterior),
    saidaPeriodoAtual: Math.max(0, r.saidaCentesimos - saidaAnterior),
    historico,
  });

  const score = clampScore(r.score - historicoAnalise.scorePenalty);
  const flags = Array.from(new Set([...r.flags, ...historicoAnalise.flags]));
  const avisos = Array.from(new Set([...r.avisos, ...historicoAnalise.avisos]));
  const aplicar = r.aplicar && !historicoAnalise.bloquearAplicacao;
  const status =
    !aplicar && historicoAnalise.bloquearAplicacao
      ? "rejected"
      : flags.some((flag) => flag.startsWith("historico_"))
        ? "needs_review"
        : r.status;
  const motivoRecusa =
    !aplicar && historicoAnalise.bloquearAplicacao
      ? "Movimentação muito fora do padrão histórico desta máquina. Confira o visor e digite manualmente."
      : r.motivoRecusa ?? null;
  let readingId: string | null = null;

  try {
    const { data: inserted } = await auth.supabase
      .from("ai_readings")
      .insert({
        empresa_id: auth.profile.empresa_id,
        equipamento_id: equipamentoId,
        ponto_id: pontoId,
        operador_id: auth.profile.user_id,
        entrada_anterior: entradaAnterior,
        saida_anterior: saidaAnterior,
        entrada_sugerida: r.entradaCentesimos || null,
        saida_sugerida: r.saidaCentesimos || null,
        entrada_final: null,
        saida_final: null,
        confidence: r.confianca,
        score,
        status,
        final_status: null,
        flags,
        avisos,
        motivo_recusa: motivoRecusa,
        modelos: r.modelosUsados,
        divergencia_digitos: r.divergenciaDigitos ?? null,
        historico_resumo: historicoAnalise.resumo,
        usando_recortes: Boolean(entradaCropDataUrl && saidaCropDataUrl),
        alternativas: r.alternativas ?? null,
        imagem_nome: foto.name || null,
        imagem_tipo: tipo,
        imagem_tamanho: foto.size,
      })
      .select("id")
      .maybeSingle();
    readingId = inserted?.id ?? null;
  } catch {}

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(auth.supabase, auth.profile, {
    request,
    acao: "ler_ia_cassino",
    tabela: "coletas_ia_cassino",
    severidade:
      status === "approved_ai"
        ? "info"
        : status === "needs_review"
          ? "medium"
          : "high",
    categoria: flags.length > 0 ? "anomalia" : "coleta",
    modulo: "coletas",
    titulo: "Leitura IA de contadores de cassino",
    resumo: aplicar
      ? `Leitura aplicada com score ${score}/100.`
      : `Leitura recusada para aplicação automática com score ${score}/100.`,
    dadosNovos: {
      entrada_anterior: entradaAnterior,
      saida_anterior: saidaAnterior,
      entrada_centesimos: r.entradaCentesimos,
      saida_centesimos: r.saidaCentesimos,
      entrada_formatada: r.entradaFormatada,
      saida_formatada: r.saidaFormatada,
      aplicar,
      confianca: r.confianca,
      score,
      status,
      flags,
      avisos,
      motivo_recusa: motivoRecusa,
      modelos: r.modelosUsados,
      divergencia_digitos: r.divergenciaDigitos ?? null,
      historico_resumo: historicoAnalise.resumo,
      usando_recortes: Boolean(entradaCropDataUrl && saidaCropDataUrl),
      alternativas: r.alternativas ?? null,
      reading_id: readingId,
    },
    meta: {
      equipamento_id: equipamentoId,
      arquivo_nome: foto.name || null,
      arquivo_tipo: tipo,
      arquivo_tamanho: foto.size,
    },
  });

  return NextResponse.json({
    aplicar,
    entrada: r.entradaFormatada,
    saida: r.saidaFormatada,
    entrada_centesimos: r.entradaCentesimos,
    saida_centesimos: r.saidaCentesimos,
    confianca: r.confianca,
    score,
    status,
    flags,
    avisos,
    motivo_recusa: motivoRecusa,
    modelo: r.modelo,
    modelos: r.modelosUsados,
    divergencia_digitos: r.divergenciaDigitos ?? null,
    historico_resumo: historicoAnalise.resumo,
    usando_recortes: Boolean(entradaCropDataUrl && saidaCropDataUrl),
    alternativas: r.alternativas ?? null,
    reading_id: readingId,
    /** Sempre true nesta feature — UI obriga confirmação antes de marcar pronta. */
    exige_confirmacao: true,
  });
}
