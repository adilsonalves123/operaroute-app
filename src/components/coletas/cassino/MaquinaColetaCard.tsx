"use client";

import { memo, useCallback, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, Gamepad2 } from "lucide-react";
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
}

function getCentesimos(input: string, anterior: number): number {
  const parsed = parseContadorInput(input);
  return parsed > 0 ? parsed : anterior;
}

interface MaquinaColetaCardProps {
  pontoId: string;
  leitura: LeituraFormState;
  index?: number;
  onUpdate: (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => void;
  onFotoChange: (id: string, file: File | null) => void;
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
  erroEntrada,
  erroSaida,
  erroFoto,
}: MaquinaColetaCardProps) {
  const entradaAtual = getCentesimos(leitura.entradaAtualInput, leitura.entradaAnterior);
  const saidaAtual = getCentesimos(leitura.saidaAtualInput, leitura.saidaAnterior);
  const lucro =
    leitura.entradaAtualInput && leitura.saidaAtualInput
      ? entradaAtual - leitura.entradaAnterior - (saidaAtual - leitura.saidaAnterior)
      : null;

  const temErro = Boolean(erroEntrada || erroSaida || erroFoto);
  const pronta =
    Boolean(leitura.entradaAtualInput.trim()) &&
    Boolean(leitura.saidaAtualInput.trim()) &&
    Boolean(leitura.fotoFile) &&
    !temErro;

  return (
    <div
      id={`maquina-${leitura.equipamentoId}`}
      className={cn(
        "scroll-mt-24 space-y-4 overflow-hidden rounded-2xl border p-4 sm:p-5",
        "bg-slate-950/60 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        temErro
          ? "border-red-500/45 ring-1 ring-red-500/15"
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
          <label className="block text-xs font-medium text-slate-400">Entrada atual *</label>
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
          <label className="block text-xs font-medium text-slate-400">Saída atual *</label>
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
        hint="Registre o visor agora — a miniatura acima é só referência."
        alt={`Foto ${leitura.nome}`}
        buttonClassName="py-6 rounded-xl"
      />
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
  };
}

export function useLeituraUpdater(setLeituras: Dispatch<SetStateAction<LeituraFormState[]>>) {
  return useCallback(
    (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => {
      setLeituras((prev) =>
        prev.map((l) => (l.equipamentoId === id ? { ...l, [field]: value } : l))
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
          };
        })
      );
    },
    [setLeituras]
  );
}

export function leiturasToCalculoInput(leituras: LeituraFormState[]) {
  return leituras
    .filter((l) => l.entradaAtualInput && l.saidaAtualInput)
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
