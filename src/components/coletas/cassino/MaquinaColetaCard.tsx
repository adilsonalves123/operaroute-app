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
  onUpdate: (id: string, field: "entradaAtualInput" | "saidaAtualInput", value: string) => void;
  onFotoChange: (id: string, file: File | null) => void;
  erroEntrada?: string | null;
  erroSaida?: string | null;
  erroFoto?: string | null;
}

export const MaquinaColetaCard = memo(function MaquinaColetaCard({
  pontoId,
  leitura,
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

  return (
    <div
      id={`maquina-${leitura.equipamentoId}`}
      className={cn(
        "glass-card p-4 space-y-4 border scroll-mt-24",
        temErro ? "border-red-500/50 ring-1 ring-red-500/20" : "border-blue-500/10"
      )}
    >
      <div className="flex items-center gap-3">
        {leitura.fotoReferenciaUrl ? (
          <ExpandableImage
            src={leitura.fotoReferenciaUrl}
            alt={`Referência ${leitura.nome}`}
            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-white/5">
            <Gamepad2 className="h-5 w-5 text-slate-600" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="font-medium text-white truncate">{leitura.nome}</p>
          <AbrirChamadoButton
            pontoId={pontoId}
            equipamentoId={leitura.equipamentoId}
            equipamentoNome={leitura.nome}
            variant="icon"
          />
          {temErro && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
              <AlertCircle className="h-3 w-3" />
              Corrigir
            </span>
          )}
        </div>
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

      <FotoColetaCaptura
        preview={leitura.fotoPreview}
        onChange={(file) => onFotoChange(leitura.equipamentoId, file)}
        erro={erroFoto}
        hint="Foto do painel agora — a miniatura acima é a referência do cadastro."
        alt={`Foto ${leitura.nome}`}
      />

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
