"use client";

import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import {
  type PeriodoAnalisePreset,
  type PeriodoAnaliseRange,
} from "@/lib/analise/periodo-analise";
import { formatCurrency } from "@/lib/utils";

type Linha = {
  nicho: string;
  label: string;
  valor: number;
};

type Props = {
  pontoId: string;
  preset: PeriodoAnalisePreset;
  label: string;
  inicioISO: string;
  fimISO: string;
  total: number;
  porNicho: Linha[];
};

/** Comissão que o ponto ganhou no período (semana / mês / personalizado). */
export function PontoComissaoPeriodo({
  pontoId,
  preset,
  label,
  inicioISO,
  fimISO,
  total,
  porNicho,
}: Props) {
  const periodo: PeriodoAnaliseRange = {
    preset,
    label,
    inicioISO,
    fimISO,
    inicio: new Date(inicioISO),
    fim: new Date(fimISO),
  };

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-4">
      <div className="space-y-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/90">
          Comissão do ponto
        </h2>
        <p className="text-[13px] text-slate-400">
          Quanto este ponto ganhou em {label.toLowerCase()}.
        </p>
      </div>

      <PeriodoAnaliseSelector
        atual={periodo}
        basePath={`/pontos/${pontoId}`}
        variante="dashboard"
      />

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Total no período
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300 tabular-nums">
          {formatCurrency(total)}
        </p>

        {porNicho.length > 1 ? (
          <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            {porNicho.map((linha) => (
              <li
                key={linha.nicho}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className="text-slate-400">{linha.label}</span>
                <span className="font-medium text-slate-200 tabular-nums">
                  {formatCurrency(linha.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {total < 0.0001 ? (
          <p className="mt-3 text-[13px] text-slate-500">
            Nenhuma comissão lançada neste período.
          </p>
        ) : null}
      </div>
    </section>
  );
}
