import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";
import type { ComissaoPontoPeriodo } from "@/lib/pontos/comissao-periodo";
import { formatCurrency } from "@/lib/utils";

type Props = {
  pontoId: string;
  periodo: PeriodoAnaliseRange;
  comissao: ComissaoPontoPeriodo;
};

/** Comissão que o ponto ganhou no período (semana / mês / personalizado). */
export function PontoComissaoPeriodo({ pontoId, periodo, comissao }: Props) {
  return (
    <section className="space-y-4 border-t border-white/[0.06] pt-8">
      <div className="space-y-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Comissão do ponto
        </h2>
        <p className="text-[13px] text-slate-500">
          Quanto este ponto ganhou de comissão em {periodo.label.toLowerCase()}.
        </p>
      </div>

      <PeriodoAnaliseSelector
        atual={periodo}
        basePath={`/pontos/${pontoId}`}
        variante="dashboard"
      />

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Total no período
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300">
          {formatCurrency(comissao.total)}
        </p>

        {comissao.porNicho.length > 1 ? (
          <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            {comissao.porNicho.map((linha) => (
              <li
                key={linha.nicho}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className="text-slate-400">{linha.label}</span>
                <span className="font-medium text-slate-200">
                  {formatCurrency(linha.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {comissao.total < 0.0001 ? (
          <p className="mt-3 text-[13px] text-slate-500">
            Nenhuma comissão lançada neste período.
          </p>
        ) : null}
      </div>
    </section>
  );
}
