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
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import { coletaInputClass } from "@/components/coletas/layout/coleta-form-styles";

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
  /** Valores vieram da IA e ainda não foram confirmados pelo operador. */
  iaPendenteConfirmacao?: boolean;
  iaAvisos?: string[];
  iaConfianca?: number | null;
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
      confianca: number;
      avisos: string[];
    }
  ) => void;
  onConfirmarIa: (id: string) => void;
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
  onIaErro,
  erroEntrada,
  erroSaida,
  erroFoto,
}: MaquinaColetaCardProps) {
  const [lendoIa, setLendoIa] = useState(false);

  const entradaAtual = getCentesimos(leitura.entradaAtualInput, leitura.entradaAnterior);
  const saidaAtual = getCentesimos(leitura.saidaAtualInput, leitura.saidaAnterior);
  const lucro =
    leitura.entradaAtualInput && leitura.saidaAtualInput
      ? entradaAtual - leitura.entradaAnterior - (saidaAtual - leitura.saidaAnterior)
      : null;

  const temErro = Boolean(erroEntrada || erroSaida || erroFoto);
  const pronta = leituraEstaPronta(leitura) && !temErro;
  const temFoto = Boolean(leitura.fotoFile || leitura.fotoPreview);

  async function lerContadores() {
    if (!leitura.fotoFile) {
      onIaErro(leitura.equipamentoId, "Tire a foto do painel antes de ler.");
      return;
    }
    setLendoIa(true);
    onIaErro(leitura.equipamentoId, null);
    try {
      const foto = await comprimirFotoParaIa(leitura.fotoFile);
      const body = new FormData();
      body.append("foto", foto);
      body.append("entrada_anterior", String(leitura.entradaAnterior));
      body.append("saida_anterior", String(leitura.saidaAnterior));

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
        onIaErro(
          leitura.equipamentoId,
          typeof data.motivo_recusa === "string"
            ? data.motivo_recusa
            : "IA não aplicou a leitura. Digite manualmente."
        );
        return;
      }

      onIaSugestao(leitura.equipamentoId, {
        entrada: String(data.entrada ?? ""),
        saida: String(data.saida ?? ""),
        confianca: Number(data.confianca) || 0,
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
        hint="Registre o visor agora — depois use Ler contadores."
        alt={`Foto ${leitura.nome}`}
        buttonClassName="py-6 rounded-xl"
      />

      {temFoto ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={lendoIa || !leitura.fotoFile}
            onClick={lerContadores}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
              "border-violet-500/35 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15",
              "disabled:cursor-not-allowed disabled:opacity-50"
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
          {!leitura.fotoFile && leitura.fotoPreview ? (
            <p className="text-[11px] text-slate-500">
              Tire uma foto nova desta coleta para a IA ler (foto só de referência não envia).
            </p>
          ) : null}
        </div>
      ) : null}

      {leitura.iaErro ? (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {leitura.iaErro}
        </p>
      ) : null}

      {leitura.iaPendenteConfirmacao ? (
        <div className="space-y-2.5 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-3.5">
          <p className="text-sm font-medium text-amber-100">
            Confirme a leitura da IA
            {leitura.iaConfianca != null
              ? ` (${Math.round(leitura.iaConfianca * 100)}%)`
              : ""}
          </p>
          <p className="text-[12px] leading-snug text-amber-100/70">
            Confira entrada e saída no visor. Sem confirmar, esta máquina não fica pronta.
          </p>
          {leitura.iaAvisos && leitura.iaAvisos.length > 0 ? (
            <ul className="list-inside list-disc text-[11px] text-amber-200/80">
              {leitura.iaAvisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => onConfirmarIa(leitura.equipamentoId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar leitura
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
    iaPendenteConfirmacao: false,
    iaAvisos: [],
    iaConfianca: null,
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
            iaPendenteConfirmacao: false,
            iaAvisos: [],
            iaConfianca: null,
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
      data: { entrada: string; saida: string; confianca: number; avisos: string[] }
    ) => {
      setLeituras((prev) =>
        prev.map((l) =>
          l.equipamentoId === id
            ? {
                ...l,
                entradaAtualInput: data.entrada,
                saidaAtualInput: data.saida,
                iaPendenteConfirmacao: true,
                iaConfianca: data.confianca,
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
        prev.map((l) =>
          l.equipamentoId === id
            ? {
                ...l,
                iaPendenteConfirmacao: false,
                iaErro: null,
              }
            : l
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
                  ? { iaPendenteConfirmacao: false }
                  : {}),
              }
            : l
        )
      );
    },
    [setLeituras]
  );

  return { onIaSugestao, onConfirmarIa, onIaErro };
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
