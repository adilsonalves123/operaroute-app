import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { iaDisponivel } from "@/lib/ia/openai-client";
import { buscarManutencaoRecente } from "@/lib/nichos/cassino/buscar-manutencao-recente";
import {
  ajustarFlagsRegressao,
  flagsIndicamRegressao,
  regressaoPermiteRevisao,
  type ExcecaoContadorTipo,
} from "@/lib/nichos/cassino/excecoes-contador";
import { CASSINO_IA_THRESHOLDS } from "@/lib/nichos/cassino/ia-thresholds";
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

function parseExcecaoContador(raw: FormDataEntryValue | null): ExcecaoContadorTipo | null {
  const value = String(raw ?? "").trim();
  if (value === "reset_contador" || value === "manutencao" || value === "troca_placa") {
    return value;
  }
  return null;
}

function aplicarExcecaoRegressao(args: {
  score: number;
  flags: string[];
  avisos: string[];
  aplicar: boolean;
  status: "approved_ai" | "needs_review" | "rejected";
  motivoRecusa: string | null;
  excecaoContador: ExcecaoContadorTipo | null;
  manutencaoRecente: boolean;
  bloquearHistorico: boolean;
}) {
  if (!flagsIndicamRegressao(args.flags)) {
    return args;
  }

  const justifica = regressaoPermiteRevisao({
    excecaoContador: args.excecaoContador,
    manutencaoRecente: args.manutencaoRecente,
  });
  if (!justifica) return args;

  const flags = ajustarFlagsRegressao({
    flags: args.flags,
    excecaoContador: args.excecaoContador,
    manutencaoRecente: args.manutencaoRecente,
  });
  const avisos = [...args.avisos];
  if (args.excecaoContador) {
    avisos.push("Regressão informada pelo operador — confira antes de confirmar.");
  } else if (args.manutencaoRecente) {
    avisos.push("Manutenção recente detectada nesta máquina.");
  }

  const penaltyRecovery = args.excecaoContador
    ? CASSINO_IA_THRESHOLDS.exceptions.regressionPenaltyRecovery
    : CASSINO_IA_THRESHOLDS.exceptions.manutencaoPenaltyRecovery;
  const score = clampScore(args.score + penaltyRecovery);

  const bloqueioDuro =
    flags.includes("divergencia_entre_leituras") ||
    flags.includes("leitura_ambigua") ||
    args.bloquearHistorico;

  const scoreMin = CASSINO_IA_THRESHOLDS.exceptions.scoreMinApplyComExcecao;
  let aplicar = args.aplicar;
  let status = args.status;
  let motivoRecusa = args.motivoRecusa;

  if (!bloqueioDuro && score >= scoreMin) {
    aplicar = true;
    status =
      score >= CASSINO_IA_THRESHOLDS.reading.scoreApprovedAi ? "approved_ai" : "needs_review";
    motivoRecusa = null;
  } else {
    aplicar = false;
    status = "needs_review";
    motivoRecusa =
      args.excecaoContador != null
        ? "Regressão informada — confira os valores e confirme manualmente."
        : "Manutenção recente nesta máquina — confira os contadores antes de confirmar.";
  }

  return { score, flags, avisos, aplicar, status, motivoRecusa };
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

  if (Math.max(entradaHist.length, saidaHist.length) < CASSINO_IA_THRESHOLDS.history.minSamples) {
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

  const thresholdEntradaAviso = Math.max(
    mediaEntrada * CASSINO_IA_THRESHOLDS.history.warningAverageMultiplier,
    maxEntrada * CASSINO_IA_THRESHOLDS.history.warningMaxMultiplier,
    CASSINO_IA_THRESHOLDS.history.warningAbsoluteFloor
  );
  const thresholdSaidaAviso = Math.max(
    mediaSaida * CASSINO_IA_THRESHOLDS.history.warningAverageMultiplier,
    maxSaida * CASSINO_IA_THRESHOLDS.history.warningMaxMultiplier,
    CASSINO_IA_THRESHOLDS.history.warningAbsoluteFloor
  );
  const thresholdEntradaBloqueio = Math.max(
    mediaEntrada * CASSINO_IA_THRESHOLDS.history.blockAverageMultiplier,
    maxEntrada * CASSINO_IA_THRESHOLDS.history.blockMaxMultiplier,
    CASSINO_IA_THRESHOLDS.history.blockAbsoluteFloor
  );
  const thresholdSaidaBloqueio = Math.max(
    mediaSaida * CASSINO_IA_THRESHOLDS.history.blockAverageMultiplier,
    maxSaida * CASSINO_IA_THRESHOLDS.history.blockMaxMultiplier,
    CASSINO_IA_THRESHOLDS.history.blockAbsoluteFloor
  );

  const flags: string[] = [];
  const avisos: string[] = [];
  let scorePenalty = 0;
  let bloquearAplicacao = false;

  if (args.entradaPeriodoAtual > thresholdEntradaAviso) {
    flags.push("historico_entrada_fora_do_padrao");
    avisos.push("Entrada do período muito acima do histórico desta máquina.");
    scorePenalty += CASSINO_IA_THRESHOLDS.history.warningPenalty;
  }
  if (args.saidaPeriodoAtual > thresholdSaidaAviso) {
    flags.push("historico_saida_fora_do_padrao");
    avisos.push("Saída do período muito acima do histórico desta máquina.");
    scorePenalty += CASSINO_IA_THRESHOLDS.history.warningPenalty;
  }
  if (args.entradaPeriodoAtual > thresholdEntradaBloqueio) {
    flags.push("historico_entrada_anomalia_severa");
    scorePenalty += CASSINO_IA_THRESHOLDS.history.blockPenalty;
  }
  if (args.saidaPeriodoAtual > thresholdSaidaBloqueio) {
    flags.push("historico_saida_anomalia_severa");
    scorePenalty += CASSINO_IA_THRESHOLDS.history.blockPenalty;
  }

  return {
    flags,
    avisos,
    scorePenalty,
    bloquearAplicacao: false,
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
  const excecaoContador = parseExcecaoContador(form.get("excecao_contador"));
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

  const manutencao = await buscarManutencaoRecente(auth.supabase, {
    empresaId: auth.profile.empresa_id!,
    equipamentoId,
  });

  const r = leitura.result;
  const historicoAnalise = analisarHistoricoMaquina({
    entradaPeriodoAtual: Math.max(0, r.entradaCentesimos - entradaAnterior),
    saidaPeriodoAtual: Math.max(0, r.saidaCentesimos - saidaAnterior),
    historico,
  });

  let score = clampScore(r.score - historicoAnalise.scorePenalty);
  let flags = Array.from(new Set([...r.flags, ...historicoAnalise.flags]));
  let avisos = Array.from(new Set([...r.avisos, ...historicoAnalise.avisos]));
  let aplicar = r.aplicar;
  let status = flags.some((flag) => flag.startsWith("historico_")) ? "needs_review" : r.status;
  let motivoRecusa = r.motivoRecusa ?? null;

  if (
    !aplicar &&
    r.entradaCentesimos > 0 &&
    r.saidaCentesimos > 0 &&
    score >= CASSINO_IA_THRESHOLDS.reading.scoreMinSugestao &&
    !flags.includes("leitura_ambigua")
  ) {
    aplicar = true;
    status = status === "rejected" ? "needs_review" : status;
    motivoRecusa =
      motivoRecusa ??
      `Confira os valores sugeridos (score ${score}/100).`;
  }

  const excecaoAjustada = aplicarExcecaoRegressao({
    score,
    flags,
    avisos,
    aplicar,
    status,
    motivoRecusa,
    excecaoContador,
    manutencaoRecente: manutencao.detectada,
    bloquearHistorico: historicoAnalise.bloquearAplicacao,
  });
  score = excecaoAjustada.score;
  flags = excecaoAjustada.flags;
  avisos = Array.from(new Set(excecaoAjustada.avisos));
  aplicar = excecaoAjustada.aplicar;
  status = excecaoAjustada.status;
  motivoRecusa = excecaoAjustada.motivoRecusa;
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
        excecao_contador: excecaoContador,
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
      excecao_contador: excecaoContador,
      manutencao_recente: manutencao.detectada ? manutencao : null,
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
    excecao_contador: excecaoContador,
    manutencao_recente: manutencao.detectada ? manutencao : null,
    reading_id: readingId,
    /** Sempre true nesta feature — UI obriga confirmação antes de marcar pronta. */
    exige_confirmacao: true,
  });
}
