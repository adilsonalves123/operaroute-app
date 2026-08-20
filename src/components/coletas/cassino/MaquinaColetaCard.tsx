"use client";

import { memo, useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, CheckCircle2, Gamepad2, Loader2, Sparkles } from "lucide-react";
import {
  formatContador,
  formatContadorInput,
  parseContadorInput,
  centesimosToReais,
} from "@/lib/nichos/cassino";
import { formatCurrency, cn } from "@/lib/utils";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { cropFileByNormalizedBox } from "@/lib/ia/crop-image";
import { analyzePhotoQuality } from "@/lib/ia/photo-quality";
import { preprocessOcrCrop } from "@/lib/ia/preprocess-ocr-image";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import {
  EXCECAO_CONTADOR_OPCOES,
  flagsIndicamRegressao,
  isRegressaoContador,
  type ExcecaoContadorTipo,
} from "@/lib/nichos/cassino/excecoes-contador";
import { coletaInputClass } from "@/components/coletas/layout/coleta-form-styles";
import {
  valoresDivergemDaSugestao,
} from "@/lib/nichos/cassino/correcao-humana";

export interface LeituraFormState {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtualInput: string;
  saidaAtualInput: string;
  fotoReferenciaUrl: string | null;
  fotoFile: File | null;
  fotoPreview: string | null;
  iaReadingId?: string | null;
  /** Valores vieram da IA e ainda não foram confirmados pelo operador. */
  iaPendenteConfirmacao?: boolean;
  iaAvisos?: string[];
  iaConfianca?: number | null;
  iaScore?: number | null;
  iaStatus?: "approved_ai" | "needs_review" | "rejected" | null;
  iaFlags?: string[];
  iaRevisaoObrigatoria?: boolean;
  iaMotivo?: string | null;
  iaAlternativas?: {
    entrada: string[];
    saida: string[];
  };
  iaSugestaoEntrada?: string | null;
  iaSugestaoSaida?: string | null;
  iaExcecaoContador?: ExcecaoContadorTipo | null;
  iaManutencaoRecente?: boolean;
  iaFoiCorrigidaManualmente?: boolean;
  iaErro?: string | null;
}

async function comprimirFotoParaIa(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg") || "painel.jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function getCentesimos(input: string, anterior: number): number {
  const parsed = parseContadorInput(input);
  return parsed > 0 ? parsed : anterior;
}

/** Máquina pronta para fechar: foto + leituras + confirmação IA se houver. */
export function leituraEstaPronta(l: LeituraFormState, exigeFoto = true): boolean {
  const temLeituras = Boolean(l.entradaAtualInput.trim() && l.saidaAtualInput.trim());
  const temFoto = Boolean(l.fotoFile || l.fotoPreview);
  if (!temLeituras) return false;
  if (exigeFoto && !temFoto) return false;
  if (l.iaPendenteConfirmacao) return false;
  return true;
}

interface MaquinaColetaCardProps {
  pontoId: string;
  leitura: LeituraFormState;
  index?: number;
  onUpdate: (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => void;
  onFotoChange: (id: string, file: File | null) => void;
  onIaSugestao: (
    id: string,
    data: {
      entrada: string;
      saida: string;
      readingId?: string | null;
      confianca: number;
      score?: number;
      status?: "approved_ai" | "needs_review" | "rejected";
      flags?: string[];
      revisaoObrigatoria?: boolean;
      motivo?: string | null;
      alternativas?: {
        entrada: string[];
        saida: string[];
      };
      manutencaoRecente?: boolean;
      avisos: string[];
    }
  ) => void;
  onConfirmarIa: (id: string) => void;
  onExcecaoContador: (id: string, excecao: ExcecaoContadorTipo | null) => void;
  onIaErro: (id: string, erro: string | null) => void;
  erroEntrada?: string | null;
  erroSaida?: string | null;
  erroFoto?: string | null;
}

export const MaquinaColetaCard = memo(function MaquinaColetaCard({
  pontoId,
  leitura,
  index = 0,
  onUpdate,
  onFotoChange,
  onIaSugestao,
  onConfirmarIa,
  onExcecaoContador,
  onIaErro,
  erroEntrada,
  erroSaida,
  erroFoto,
}: MaquinaColetaCardProps) {
  const [lendoIa, setLendoIa] = useState(false);

  const entradaAtual = getCentesimos(leitura.entradaAtualInput, leitura.entradaAnterior);
  const saidaAtual = getCentesimos(leitura.saidaAtualInput, leitura.saidaAnterior);
  const temRegressao =
    isRegressaoContador({
      entradaAtual,
      entradaAnterior: leitura.entradaAnterior,
      saidaAtual,
      saidaAnterior: leitura.saidaAnterior,
    }) || flagsIndicamRegressao(leitura.iaFlags ?? []);
  const temLeituras =
    Boolean(leitura.entradaAtualInput.trim()) && Boolean(leitura.saidaAtualInput.trim());
  const entradaPeriodo = temLeituras ? entradaAtual - leitura.entradaAnterior : null;
  const saidaPeriodo = temLeituras ? saidaAtual - leitura.saidaAnterior : null;
  const lucro =
    temLeituras && entradaPeriodo != null && saidaPeriodo != null
      ? entradaPeriodo - saidaPeriodo
      : null;

  const temErro = Boolean(erroEntrada || erroSaida || erroFoto);
  const pronta = leituraEstaPronta(leitura) && !temErro;

  async function lerContadores() {
    if (!leitura.fotoFile) {
      onIaErro(leitura.equipamentoId, "Tire a foto do painel antes de ler.");
      return;
    }
    setLendoIa(true);
    onIaErro(leitura.equipamentoId, null);
    try {
      const quality = await analyzePhotoQuality(leitura.fotoFile);
      if (!quality.ok) {
        onIaErro(
          leitura.equipamentoId,
          `Não conseguimos ler esta imagem com segurança. Tire outra foto. ${quality.reasons.join(" ")}`
        );
        return;
      }

      const foto = await comprimirFotoParaIa(leitura.fotoFile);
      let fotoEntradaCrop: File | null = null;
      let fotoSaidaCrop: File | null = null;

      try {
        const localizarBody = new FormData();
        localizarBody.append("foto", foto);

        const localizarRes = await fetch("/api/coletas/cassino/localizar-contadores", {
          method: "POST",
          credentials: "include",
          body: localizarBody,
        });
        const localizarData = await localizarRes.json().catch(() => ({}));
        if (
          localizarRes.ok &&
          localizarData?.localizar === true &&
          localizarData?.entradaBox &&
          localizarData?.saidaBox
        ) {
          const entradaCropBruto = await cropFileByNormalizedBox(
            leitura.fotoFile,
            localizarData.entradaBox,
            "entrada-crop.jpg"
          );
          const saidaCropBruto = await cropFileByNormalizedBox(
            leitura.fotoFile,
            localizarData.saidaBox,
            "saida-crop.jpg"
          );
          fotoEntradaCrop = await preprocessOcrCrop(
            entradaCropBruto,
            "entrada-crop-ocr.jpg"
          );
          fotoSaidaCrop = await preprocessOcrCrop(
            saidaCropBruto,
            "saida-crop-ocr.jpg"
          );
        }
      } catch {
        fotoEntradaCrop = null;
        fotoSaidaCrop = null;
      }

      const body = new FormData();
      body.append("foto", foto);
      if (fotoEntradaCrop) body.append("foto_entrada", fotoEntradaCrop);
      if (fotoSaidaCrop) body.append("foto_saida", fotoSaidaCrop);
      body.append("ponto_id", pontoId);
      body.append("equipamento_id", leitura.equipamentoId);
      body.append("entrada_anterior", String(leitura.entradaAnterior));
      body.append("saida_anterior", String(leitura.saidaAnterior));
      if (leitura.iaExcecaoContador) {
        body.append("excecao_contador", leitura.iaExcecaoContador);
      }

      const res = await fetch("/api/coletas/cassino/ler-contadores", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onIaErro(
          leitura.equipamentoId,
          typeof data.error === "string" ? data.error : "Falha ao ler contadores."
        );
        return;
      }

      if (!data.aplicar) {
        const alternativas =
          data.alternativas &&
          typeof data.alternativas === "object" &&
          Array.isArray(data.alternativas.entrada) &&
          Array.isArray(data.alternativas.saida)
            ? {
                entrada: data.alternativas.entrada.map(String),
                saida: data.alternativas.saida.map(String),
              }
            : null;
        if (
          alternativas &&
          (alternativas.entrada.length > 0 || alternativas.saida.length > 0)
        ) {
          onIaSugestao(leitura.equipamentoId, {
            entrada:
              String(data.entrada ?? "") ||
              alternativas.entrada[0] ||
              leitura.entradaAtualInput,
            saida:
              String(data.saida ?? "") ||
              alternativas.saida[0] ||
              leitura.saidaAtualInput,
            readingId: typeof data.reading_id === "string" ? data.reading_id : null,
            confianca: Number(data.confianca) || 0,
            score: Number(data.score) || 0,
            status:
              data.status === "approved_ai" ||
              data.status === "needs_review" ||
              data.status === "rejected"
                ? data.status
                : "rejected",
            flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
            revisaoObrigatoria: true,
            motivo:
              typeof data.motivo_recusa === "string"
                ? data.motivo_recusa
                : "Encontramos dúvida na leitura. Escolha a opção correta abaixo.",
            alternativas,
            manutencaoRecente: Boolean(data.manutencao_recente?.detectada),
            avisos: Array.isArray(data.avisos) ? data.avisos.map(String) : [],
          });
        } else {
          onIaErro(
            leitura.equipamentoId,
            typeof data.motivo_recusa === "string"
              ? data.motivo_recusa
              : "IA não aplicou a leitura. Digite manualmente."
          );
        }
        return;
      }

      onIaSugestao(leitura.equipamentoId, {
        entrada: String(data.entrada ?? ""),
        saida: String(data.saida ?? ""),
        readingId: typeof data.reading_id === "string" ? data.reading_id : null,
        confianca: Number(data.confianca) || 0,
        score: Number(data.score) || 0,
        status:
          data.status === "approved_ai" ||
          data.status === "needs_review" ||
          data.status === "rejected"
            ? data.status
            : "needs_review",
        flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
        revisaoObrigatoria: false,
        motivo: null,
        alternativas:
          data.alternativas &&
          typeof data.alternativas === "object" &&
          Array.isArray(data.alternativas.entrada) &&
          Array.isArray(data.alternativas.saida)
            ? {
                entrada: data.alternativas.entrada.map(String),
                saida: data.alternativas.saida.map(String),
              }
            : undefined,
        manutencaoRecente: Boolean(data.manutencao_recente?.detectada),
        avisos: Array.isArray(data.avisos) ? data.avisos.map(String) : [],
      });
    } catch {
      onIaErro(leitura.equipamentoId, "Erro de conexão ao ler a foto.");
    } finally {
      setLendoIa(false);
    }
  }

  return (
    <div
      id={`maquina-${leitura.equipamentoId}`}
      className={cn(
        "scroll-mt-24 space-y-4 overflow-hidden rounded-2xl border p-4 sm:p-5",
        "bg-slate-950/60 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        temErro
          ? "border-red-500/45 ring-1 ring-red-500/15"
          : leitura.iaPendenteConfirmacao
            ? "border-amber-400/40 ring-1 ring-amber-400/15"
            : pronta
              ? "border-cyan-400/30 ring-1 ring-cyan-400/10"
              : "border-white/[0.07]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {leitura.fotoReferenciaUrl ? (
            <ExpandableImage
              src={leitura.fotoReferenciaUrl}
              alt={`Referência ${leitura.nome}`}
              className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10"
              fullWidth={false}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/15">
              <Gamepad2 className="h-6 w-6 text-cyan-400/70" />
            </div>
          )}
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-cyan-400 text-[10px] font-bold text-slate-950">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-white">{leitura.nome}</p>
            <AbrirChamadoButton
              pontoId={pontoId}
              equipamentoId={leitura.equipamentoId}
              equipamentoNome={leitura.nome}
              variant="icon"
            />
            {temErro ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                <AlertCircle className="h-3 w-3" />
                Corrigir
              </span>
            ) : leitura.iaRevisaoObrigatoria ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                Revisão IA
              </span>
            ) : leitura.iaPendenteConfirmacao ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Confirme a IA
              </span>
            ) : pronta ? (
              <span className="ml-auto text-xs text-emerald-400">Pronta</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {leitura.fotoReferenciaUrl
              ? "Miniatura = última foto cadastrada"
              : "Sem foto de referência no cadastro"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Entrada ant.
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-200">
            {formatContador(leitura.entradaAnterior)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Saída ant.
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-200">
            {formatContador(leitura.saidaAnterior)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">
            Entrada atual *
            {leitura.iaPendenteConfirmacao ? (
              <span className="ml-1.5 font-normal text-amber-400/90">sugerido</span>
            ) : null}
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={leitura.entradaAtualInput}
            onChange={(e) =>
              onUpdate(
                leitura.equipamentoId,
                "entradaAtualInput",
                formatContadorInput(e.target.value)
              )
            }
            className={coletaInputClass(Boolean(erroEntrada))}
            aria-invalid={Boolean(erroEntrada)}
          />
          {erroEntrada ? (
            <p className="text-xs leading-snug text-red-400">{erroEntrada}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">
            Saída atual *
            {leitura.iaPendenteConfirmacao ? (
              <span className="ml-1.5 font-normal text-amber-400/90">sugerido</span>
            ) : null}
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={leitura.saidaAtualInput}
            onChange={(e) =>
              onUpdate(
                leitura.equipamentoId,
                "saidaAtualInput",
                formatContadorInput(e.target.value)
              )
            }
            className={coletaInputClass(Boolean(erroSaida))}
            aria-invalid={Boolean(erroSaida)}
          />
          {erroSaida ? (
            <p className="text-xs leading-snug text-red-400">{erroSaida}</p>
          ) : null}
        </div>
      </div>

      {entradaPeriodo != null && saidaPeriodo != null && !erroEntrada && !erroSaida ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5",
              entradaPeriodo < 0
                ? "border-red-500/40 bg-red-500/10"
                : "border-cyan-500/20 bg-cyan-500/[0.06]"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Entrada no período
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                entradaPeriodo < 0 ? "text-red-400" : "text-cyan-300"
              )}
            >
              {formatContador(entradaPeriodo)}
            </p>
            {entradaPeriodo < 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-red-300/90">
                Menor que a anterior — leitura suspeita
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5",
              saidaPeriodo < 0
                ? "border-red-500/40 bg-red-500/10"
                : "border-cyan-500/20 bg-cyan-500/[0.06]"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Saída no período
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                saidaPeriodo < 0 ? "text-red-400" : "text-cyan-300"
              )}
            >
              {formatContador(saidaPeriodo)}
            </p>
            {saidaPeriodo < 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-red-300/90">
                Menor que a anterior — leitura suspeita
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {lucro !== null && !erroEntrada && !erroSaida ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-sm">
          <span className="text-slate-400">Lucro da máquina</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              lucro >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {formatCurrency(centesimosToReais(lucro))}
          </span>
        </div>
      ) : null}

      <FotoColetaCaptura
        preview={leitura.fotoPreview}
        onChange={(file) => onFotoChange(leitura.equipamentoId, file)}
        erro={erroFoto}
        label="Foto do painel *"
        hint="Toque em Foto → Câmera ou Galeria. Depois use a IA."
        alt={`Foto ${leitura.nome}`}
        buttonClassName="py-6 rounded-xl"
      />

      <div className="space-y-2">
        <button
          type="button"
          disabled={lendoIa}
          onClick={() => {
            if (!leitura.fotoFile) {
              onIaErro(
                leitura.equipamentoId,
                "Escolha uma foto na Galeria (ou tire na Câmera) antes de ler com a IA."
              );
              return;
            }
            void lerContadores();
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
            "border-violet-500/35 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !leitura.fotoFile && "opacity-80"
          )}
        >
          {lendoIa ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Lendo painel…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Ler contadores com IA
            </>
          )}
        </button>
        {!leitura.fotoFile ? (
          <p className="text-center text-[11px] text-slate-500">
            {leitura.fotoPreview
              ? "Tire uma foto nova desta coleta para a IA ler (foto só de referência não envia)."
              : "Tire a foto do painel acima para liberar a leitura com IA."}
          </p>
        ) : (
          <p className="text-center text-[11px] text-violet-300/70">
            A IA sugere entrada/saída — você confirma antes de salvar. Foto muito escura, borrada ou estourada é bloqueada antes da leitura.
          </p>
        )}
      </div>

      {leitura.iaErro ? (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {leitura.iaErro}
        </p>
      ) : null}

      {leitura.iaPendenteConfirmacao || leitura.iaRevisaoObrigatoria ? (
        <div
          className={cn(
            "space-y-2.5 rounded-xl border p-3.5",
            leitura.iaRevisaoObrigatoria
              ? "border-rose-400/30 bg-rose-500/[0.08]"
              : "border-amber-400/30 bg-amber-500/[0.08]"
          )}
        >
          <p className="text-sm font-medium text-amber-100">
            {leitura.iaRevisaoObrigatoria ? "Revise a leitura da IA" : "Confirme a leitura da IA"}
            {leitura.iaConfianca != null
              ? ` (${Math.round(leitura.iaConfianca * 100)}%)`
              : ""}
          </p>
          {(leitura.iaScore != null || leitura.iaStatus) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {leitura.iaScore != null ? (
                <span className="rounded-full bg-black/20 px-2 py-1 text-amber-50">
                  Score {Math.round(leitura.iaScore)}/100
                </span>
              ) : null}
              {leitura.iaStatus ? (
                <span className="rounded-full bg-black/20 px-2 py-1 text-amber-50">
                  {leitura.iaStatus === "approved_ai"
                    ? "Alta confiança"
                    : leitura.iaStatus === "needs_review"
                      ? "Revisão rápida"
                      : "Revisão obrigatória"}
                </span>
              ) : null}
            </div>
          )}
          {entradaPeriodo != null && saidaPeriodo != null ? (
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="text-amber-100/60">Entrada período</span>
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    entradaPeriodo < 0 ? "text-red-300" : "text-amber-50"
                  )}
                >
                  {formatContador(entradaPeriodo)}
                </p>
              </div>
              <div>
                <span className="text-amber-100/60">Saída período</span>
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    saidaPeriodo < 0 ? "text-red-300" : "text-amber-50"
                  )}
                >
                  {formatContador(saidaPeriodo)}
                </p>
              </div>
            </div>
          ) : null}
          <p className="text-[12px] leading-snug text-amber-100/70">
            {leitura.iaMotivo ||
              "Confira no visor. Se o período ficou negativo, a leitura provavelmente está errada."}
          </p>
          {leitura.iaAlternativas &&
          (leitura.iaAlternativas.entrada.length > 0 || leitura.iaAlternativas.saida.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {leitura.iaAlternativas.entrada.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-amber-100/80">Escolha a Entrada</p>
                  <div className="flex flex-wrap gap-2">
                    {leitura.iaAlternativas.entrada.map((opcao) => (
                      <button
                        key={`entrada-${opcao}`}
                        type="button"
                        onClick={() =>
                          onUpdate(leitura.equipamentoId, "entradaAtualInput", opcao)
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition",
                          leitura.entradaAtualInput === opcao
                            ? "border-amber-300 bg-amber-300/20 text-amber-50"
                            : "border-white/10 bg-black/20 text-amber-100/80 hover:bg-black/30"
                        )}
                      >
                        {opcao}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {leitura.iaAlternativas.saida.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-amber-100/80">Escolha a Saída</p>
                  <div className="flex flex-wrap gap-2">
                    {leitura.iaAlternativas.saida.map((opcao) => (
                      <button
                        key={`saida-${opcao}`}
                        type="button"
                        onClick={() =>
                          onUpdate(leitura.equipamentoId, "saidaAtualInput", opcao)
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition",
                          leitura.saidaAtualInput === opcao
                            ? "border-amber-300 bg-amber-300/20 text-amber-50"
                            : "border-white/10 bg-black/20 text-amber-100/80 hover:bg-black/30"
                        )}
                      >
                        {opcao}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {leitura.iaAvisos && leitura.iaAvisos.length > 0 ? (
            <ul className="list-inside list-disc text-[11px] text-amber-200/80">
              {leitura.iaAvisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {leitura.iaFlags && leitura.iaFlags.length > 0 ? (
            <p className="text-[11px] leading-snug text-amber-100/70">
              Validações ativas: {leitura.iaFlags.join(", ")}.
            </p>
          ) : null}
          {temRegressao ? (
            <div className="space-y-2 rounded-xl border border-rose-400/25 bg-black/20 p-3">
              <p className="text-[11px] font-medium text-rose-100">
                Leitura menor que a anterior
              </p>
              <p className="text-[11px] leading-snug text-rose-100/75">
                Se houve reset, manutenção ou troca de placa, informe abaixo para registrar a
                exceção.
              </p>
              {leitura.iaManutencaoRecente ? (
                <p className="text-[11px] text-cyan-200/90">
                  Manutenção recente detectada nesta máquina.
                </p>
              ) : null}
              <select
                value={leitura.iaExcecaoContador ?? ""}
                onChange={(e) =>
                  onExcecaoContador(
                    leitura.equipamentoId,
                    (e.target.value || null) as ExcecaoContadorTipo | null
                  )
                }
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-amber-50"
              >
                <option value="">Selecione o motivo (se aplicável)</option>
                {EXCECAO_CONTADOR_OPCOES.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.label}
                  </option>
                ))}
              </select>
              {leitura.iaExcecaoContador ? (
                <p className="text-[10px] leading-snug text-amber-100/70">
                  {
                    EXCECAO_CONTADOR_OPCOES.find((o) => o.id === leitura.iaExcecaoContador)
                      ?.descricao
                  }
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={temRegressao && !leitura.iaExcecaoContador && !leitura.iaManutencaoRecente}
            onClick={() => onConfirmarIa(leitura.equipamentoId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {leitura.iaRevisaoObrigatoria ? "Confirmar revisão" : "Confirmar leitura"}
          </button>
        </div>
      ) : null}
    </div>
  );
});

export function leituraToInput(eq: {
  id: string;
  nome: string;
  numero_maquina?: string | null;
  numero_entrada: number | null;
  numero_saida: number | null;
  foto_url?: string | null;
}): LeituraFormState {
  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    entradaAnterior: Math.round(Number(eq.numero_entrada ?? 0)),
    saidaAnterior: Math.round(Number(eq.numero_saida ?? 0)),
    entradaAtualInput: "",
    saidaAtualInput: "",
    fotoReferenciaUrl: eq.foto_url ?? null,
    fotoFile: null,
    fotoPreview: null,
    iaReadingId: null,
    iaPendenteConfirmacao: false,
    iaAvisos: [],
    iaConfianca: null,
    iaScore: null,
    iaStatus: null,
    iaFlags: [],
    iaRevisaoObrigatoria: false,
    iaMotivo: null,
    iaAlternativas: { entrada: [], saida: [] },
    iaSugestaoEntrada: null,
    iaSugestaoSaida: null,
    iaExcecaoContador: null,
    iaManutencaoRecente: false,
    iaFoiCorrigidaManualmente: false,
    iaErro: null,
  };
}

export function useLeituraUpdater(setLeituras: Dispatch<SetStateAction<LeituraFormState[]>>) {
  return useCallback(
    (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => {
      setLeituras((prev) =>
        prev.map((l) => {
          if (l.equipamentoId !== id) return l;
          // Edição manual mantém pendência se ainda veio da IA (precisa confirmar o valor final).
          return { ...l, [field]: value, iaErro: null };
        })
      );
    },
    [setLeituras]
  );
}

export function useFotoUpdater(setLeituras: Dispatch<SetStateAction<LeituraFormState[]>>) {
  return useCallback(
    (id: string, file: File | null) => {
      setLeituras((prev) =>
        prev.map((l) => {
          if (l.equipamentoId !== id) return l;
          if (l.fotoPreview) URL.revokeObjectURL(l.fotoPreview);
          return {
            ...l,
            fotoFile: file,
            fotoPreview: file ? URL.createObjectURL(file) : null,
            iaReadingId: null,
            iaPendenteConfirmacao: false,
            iaAvisos: [],
            iaConfianca: null,
            iaScore: null,
            iaStatus: null,
            iaFlags: [],
            iaRevisaoObrigatoria: false,
            iaMotivo: null,
            iaAlternativas: { entrada: [], saida: [] },
            iaSugestaoEntrada: null,
            iaSugestaoSaida: null,
            iaExcecaoContador: null,
            iaManutencaoRecente: false,
            iaFoiCorrigidaManualmente: false,
            iaErro: null,
          };
        })
      );
    },
    [setLeituras]
  );
}

export function useIaLeituraHandlers(setLeituras: Dispatch<SetStateAction<LeituraFormState[]>>) {
  const onIaSugestao = useCallback(
    (
      id: string,
      data: {
        entrada: string;
        saida: string;
        readingId?: string | null;
        confianca: number;
        score?: number;
        status?: "approved_ai" | "needs_review" | "rejected";
        flags?: string[];
        revisaoObrigatoria?: boolean;
        motivo?: string | null;
        alternativas?: {
          entrada: string[];
          saida: string[];
        };
        manutencaoRecente?: boolean;
        avisos: string[];
      }
    ) => {
      setLeituras((prev) =>
        prev.map((l) =>
          l.equipamentoId === id
            ? {
                ...l,
                entradaAtualInput: data.entrada,
                saidaAtualInput: data.saida,
                iaReadingId: data.readingId ?? l.iaReadingId ?? null,
                iaPendenteConfirmacao: true,
                iaConfianca: data.confianca,
                iaScore: data.score ?? null,
                iaStatus: data.status ?? "needs_review",
                iaFlags: data.flags ?? [],
                iaRevisaoObrigatoria: data.revisaoObrigatoria ?? false,
                iaMotivo: data.motivo ?? null,
                iaAlternativas: data.alternativas ?? { entrada: [], saida: [] },
                iaSugestaoEntrada: data.entrada,
                iaSugestaoSaida: data.saida,
                iaExcecaoContador: l.iaExcecaoContador ?? null,
                iaManutencaoRecente: Boolean(data.manutencaoRecente),
                iaFoiCorrigidaManualmente: false,
                iaAvisos: data.avisos,
                iaErro: null,
              }
            : l
        )
      );
    },
    [setLeituras]
  );

  const onConfirmarIa = useCallback(
    (id: string) => {
      setLeituras((prev) =>
        prev.map((l) => {
          if (l.equipamentoId !== id) return l;
          const divergiu = valoresDivergemDaSugestao({
            entradaSugerida: l.iaSugestaoEntrada ?? null,
            saidaSugerida: l.iaSugestaoSaida ?? null,
            entradaFinal: l.entradaAtualInput,
            saidaFinal: l.saidaAtualInput,
          });
          const manual =
            Boolean(l.iaRevisaoObrigatoria) ||
            Boolean(l.iaExcecaoContador) ||
            divergiu;
          return {
            ...l,
            iaPendenteConfirmacao: false,
            iaRevisaoObrigatoria: false,
            iaFoiCorrigidaManualmente: manual,
            iaStatus: manual ? "needs_review" : l.iaStatus ?? "approved_ai",
            iaErro: null,
          };
        })
      );
    },
    [setLeituras]
  );

  const onExcecaoContador = useCallback(
    (id: string, excecao: ExcecaoContadorTipo | null) => {
      setLeituras((prev) =>
        prev.map((l) =>
          l.equipamentoId === id ? { ...l, iaExcecaoContador: excecao, iaErro: null } : l
        )
      );
    },
    [setLeituras]
  );

  const onIaErro = useCallback(
    (id: string, erro: string | null) => {
      setLeituras((prev) =>
        prev.map((l) =>
          l.equipamentoId === id
            ? {
                ...l,
                iaErro: erro,
                ...(erro
                  ? {
                      iaPendenteConfirmacao: false,
                      iaRevisaoObrigatoria: false,
                      iaStatus: "rejected" as const,
                    }
                  : {}),
              }
            : l
        )
      );
    },
    [setLeituras]
  );

  return { onIaSugestao, onConfirmarIa, onExcecaoContador, onIaErro };
}

export function leiturasToCalculoInput(leituras: LeituraFormState[]) {
  return leituras
    .filter((l) => l.entradaAtualInput && l.saidaAtualInput && !l.iaPendenteConfirmacao)
    .map((l) => ({
      equipamentoId: l.equipamentoId,
      nome: l.nome,
      entradaAnterior: l.entradaAnterior,
      saidaAnterior: l.saidaAnterior,
      entradaAtual: parseContadorInput(l.entradaAtualInput),
      saidaAtual: parseContadorInput(l.saidaAtualInput),
      fotoUri: l.fotoPreview,
    }));
}
