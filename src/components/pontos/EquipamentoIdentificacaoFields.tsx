"use client";

import { useState } from "react";
import { FormInput } from "@/components/ui/FormInput";
import { HistoricoNumeroSerie } from "@/components/pontos/HistoricoNumeroSerie";
import { LerNumeroDaFoto } from "@/components/coletas/LerNumeroDaFoto";
import { cn } from "@/lib/utils";

export const LABEL_NUMERO_PONTO = "Nº no ponto";
export const LABEL_SERIE_PAINEL = "Série do painel";
export const HINT_NUMERO_PONTO =
  "Como você identifica a máquina neste bar ou ponto (ex: 01, Máquina 3).";
export const HINT_SERIE_PAINEL =
  "Código no visor ou plaqueta — usado para histórico, busca e transferências.";

type HistoricoSugestao = {
  nome: string;
  numero_entrada: string;
  numero_saida: string;
  foto_url: string | null;
};

type Props = {
  exigeSerie: boolean;
  /** Mostra o campo de série mesmo sem exigi-lo (ex.: cadeira de massagem sem painel). */
  serieOpcional?: boolean;
  numeroSerie: string;
  numeroMaquina: string;
  onSerieChange: (value: string) => void;
  onNumeroChange: (value: string) => void;
  pontoId?: string;
  onHistoricoSugestao?: (dados: HistoricoSugestao) => void;
  numeroMaquinaObrigatorio?: boolean;
};

function inicializarMesmoValor(serie: string, numero: string): boolean {
  const s = serie.trim();
  const n = numero.trim();
  return s.length > 0 && s === n;
}

export function EquipamentoIdentificacaoFields({
  exigeSerie,
  serieOpcional = false,
  numeroSerie,
  numeroMaquina,
  onSerieChange,
  onNumeroChange,
  pontoId,
  onHistoricoSugestao,
  numeroMaquinaObrigatorio = true,
}: Props) {
  const [usarSerieComoNumero, setUsarSerieComoNumero] = useState(() =>
    inicializarMesmoValor(numeroSerie, numeroMaquina)
  );

  function handleSerieChange(value: string) {
    onSerieChange(value);
    if (usarSerieComoNumero) onNumeroChange(value);
  }

  function handleNumeroChange(value: string) {
    onNumeroChange(value);
    if (usarSerieComoNumero && value.trim() !== numeroSerie.trim()) {
      setUsarSerieComoNumero(false);
    }
  }

  function handleMesmoValor(checked: boolean) {
    setUsarSerieComoNumero(checked);
    if (checked && numeroSerie.trim()) {
      onNumeroChange(numeroSerie);
    }
  }

  if (!exigeSerie && serieOpcional) {
    return (
      <div className="space-y-3">
        <FormInput
          label={LABEL_SERIE_PAINEL}
          placeholder="Ex: SN123456789 (opcional)"
          value={numeroSerie}
          onChange={(e) => onSerieChange(e.target.value)}
          hint="Deixe em branco se a máquina não tiver painel com série."
        />
        <LerNumeroDaFoto modo="texto" onUsar={onSerieChange} />
        <FormInput
          label={`${LABEL_NUMERO_PONTO}${numeroMaquinaObrigatorio ? " *" : ""}`}
          placeholder="Ex: 01, A12"
          value={numeroMaquina}
          onChange={(e) => onNumeroChange(e.target.value)}
          hint={HINT_NUMERO_PONTO}
        />
      </div>
    );
  }

  if (!exigeSerie) {
    return (
      <FormInput
        label={`${LABEL_NUMERO_PONTO}${numeroMaquinaObrigatorio ? " *" : ""}`}
        placeholder="Ex: 01, A12"
        value={numeroMaquina}
        onChange={(e) => onNumeroChange(e.target.value)}
        hint={HINT_NUMERO_PONTO}
      />
    );
  }

  return (
    <div className="space-y-3">
      <FormInput
        label={`${LABEL_SERIE_PAINEL} *`}
        placeholder="Ex: SN123456789"
        value={numeroSerie}
        onChange={(e) => handleSerieChange(e.target.value)}
        hint={HINT_SERIE_PAINEL}
      />
      <LerNumeroDaFoto modo="texto" onUsar={handleSerieChange} />

      {numeroSerie.trim().length >= 2 && onHistoricoSugestao && (
        <HistoricoNumeroSerie
          serie={numeroSerie}
          pontoId={pontoId}
          compacto
          onAplicarSugestao={onHistoricoSugestao}
        />
      )}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5",
          "hover:border-slate-700 transition"
        )}
      >
        <input
          type="checkbox"
          checked={usarSerieComoNumero}
          onChange={(e) => handleMesmoValor(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-primary-neon focus:ring-primary-neon/30"
        />
        <span className="text-sm text-slate-300">
          Usar a série do painel como nº no ponto
          <span className="mt-0.5 block text-xs text-slate-500">
            Marque quando o código do visor for o mesmo que você usa no dia a dia neste ponto.
          </span>
        </span>
      </label>

      <FormInput
        label={`${LABEL_NUMERO_PONTO}${numeroMaquinaObrigatorio ? " *" : ""}`}
        placeholder="Ex: 01, Máquina 3"
        value={numeroMaquina}
        onChange={(e) => handleNumeroChange(e.target.value)}
        hint={usarSerieComoNumero ? "Igual à série do painel." : HINT_NUMERO_PONTO}
        disabled={usarSerieComoNumero}
        className={usarSerieComoNumero ? "opacity-70" : undefined}
      />
    </div>
  );
}
