"use client";

import { memo, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, Camera, Gamepad2, X } from "lucide-react";
import {
  formatContador,
  formatContadorInput,
  parseContadorInput,
  centesimosToReais,
} from "@/lib/nichos/cassino";
import { formatCurrency, cn } from "@/lib/utils";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { ExpandableImage } from "@/components/ui/ExpandableImage";

export interface LeituraFormState {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtualInput: string;
  saidaAtualInput: string;
  fotoFile: File | null;
  fotoPreview: string | null;
}

function getCentesimos(input: string, anterior: number): number {
  const parsed = parseContadorInput(input);
  return parsed > 0 ? parsed : anterior;
}

interface MaquinaColetaCardProps {
  leitura: LeituraFormState;
  onUpdate: (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => void;
  onFotoChange: (id: string, file: File | null) => void;
  erroEntrada?: string | null;
  erroSaida?: string | null;
  erroFoto?: string | null;
}

export const MaquinaColetaCard = memo(function MaquinaColetaCard({
  leitura,
  onUpdate,
  onFotoChange,
  erroEntrada,
  erroSaida,
  erroFoto,
}: MaquinaColetaCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const entradaAtual = getCentesimos(leitura.entradaAtualInput, leitura.entradaAnterior);
  const saidaAtual = getCentesimos(leitura.saidaAtualInput, leitura.saidaAnterior);
  const lucro =
    leitura.entradaAtualInput && leitura.saidaAtualInput
      ? entradaAtual - leitura.entradaAnterior - (saidaAtual - leitura.saidaAnterior)
      : null;

  const temErro = Boolean(erroEntrada || erroSaida || erroFoto);

  function handleFile(file: File | null) {
    onFotoChange(leitura.equipamentoId, file);
  }

  return (
    <div
      id={`maquina-${leitura.equipamentoId}`}
      className={cn(
        "glass-card p-4 space-y-4 border scroll-mt-24",
        temErro ? "border-red-500/50 ring-1 ring-red-500/20" : "border-blue-500/10"
      )}
    >
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-primary-neon shrink-0" />
        <p className="font-medium text-white">{leitura.nome}</p>
        {temErro && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
            <AlertCircle className="h-3 w-3" />
            Corrigir
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
        <div>
          Entrada ant.:{" "}
          <span className="text-slate-300">{formatContador(leitura.entradaAnterior)}</span>
        </div>
        <div>
          Saída ant.:{" "}
          <span className="text-slate-300">{formatContador(leitura.saidaAnterior)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Entrada atual *</label>
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
            className={cn("w-full", erroEntrada && "border-red-500 focus:border-red-500")}
            aria-invalid={Boolean(erroEntrada)}
          />
          {erroEntrada && (
            <p className="text-xs text-red-400 leading-snug">{erroEntrada}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Saída atual *</label>
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
            className={cn("w-full", erroSaida && "border-red-500 focus:border-red-500")}
            aria-invalid={Boolean(erroSaida)}
          />
          {erroSaida && <p className="text-xs text-red-400 leading-snug">{erroSaida}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Foto da máquina *</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {leitura.fotoPreview ? (
          <div className="relative">
            <ExpandableImage
              src={leitura.fotoPreview}
              alt={`Foto ${leitura.nome}`}
              className="h-36"
            />
            <button
              type="button"
              onClick={() => {
                handleFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm hover:border-primary-neon/40 hover:text-primary-neon",
              erroFoto
                ? "border-red-500/50 text-red-400"
                : "border-slate-600 text-slate-400"
            )}
          >
            <Camera className="h-5 w-5" />
            Tirar foto ou escolher da galeria
          </button>
        )}
        {erroFoto && <p className="text-xs text-red-400">{erroFoto}</p>}
      </div>

      {lucro !== null && !erroEntrada && !erroSaida && (
        <div className="rounded-lg bg-slate-900/60 px-3 py-2 flex justify-between text-sm">
          <span className="text-slate-400">Lucro da máquina</span>
          <span
            className={
              lucro >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"
            }
          >
            {formatCurrency(centesimosToReais(lucro))}
          </span>
        </div>
      )}
    </div>
  );
});

export function leituraToInput(eq: {
  id: string;
  nome: string;
  numero_maquina?: string | null;
  numero_entrada: number | null;
  numero_saida: number | null;
}): LeituraFormState {
  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    entradaAnterior: Math.round(Number(eq.numero_entrada ?? 0)),
    saidaAnterior: Math.round(Number(eq.numero_saida ?? 0)),
    entradaAtualInput: "",
    saidaAtualInput: "",
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
