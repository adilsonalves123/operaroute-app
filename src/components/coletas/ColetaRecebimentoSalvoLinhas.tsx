import type { RelatorioCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";
import { formatCurrency } from "@/lib/utils";

type CalculoRecebido = {
  valorPagoRecebido: number;
  saldoPendente: number;
  haver: number;
};

/** Linhas de recebimento já salvo (dívida anterior + coleta + total visita). */
export function ColetaRecebimentoSalvoLinhas({
  calculo,
  cobrancaSalva = null,
  totalPagoVisita,
}: {
  calculo: CalculoRecebido;
  cobrancaSalva?: RelatorioCobrancaDetalhe | null;
  totalPagoVisita?: number;
}) {
  if (calculo.valorPagoRecebido <= 0.009) return null;

  return (
    <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Recebimento
      </p>
      {(cobrancaSalva?.dividaAnterior ?? 0) > 0.009 ? (
        <div className="flex justify-between gap-3">
          <span className="text-amber-300">Dívida anterior quitada</span>
          <span className="font-semibold text-amber-400 tabular-nums">
            {formatCurrency(cobrancaSalva!.dividaAnterior!)}
          </span>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Recebido desta coleta</span>
        <span className="font-semibold text-green-400 tabular-nums">
          {formatCurrency(calculo.valorPagoRecebido)}
        </span>
      </div>
      {totalPagoVisita != null && totalPagoVisita > calculo.valorPagoRecebido + 0.009 ? (
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Total pago na visita</span>
          <span className="font-medium text-slate-200 tabular-nums">
            {formatCurrency(totalPagoVisita)}
          </span>
        </div>
      ) : null}
      {calculo.saldoPendente > 0.009 ? (
        <div className="flex justify-between gap-3">
          <span className="text-amber-300">Pendente</span>
          <span className="font-bold text-amber-400 tabular-nums">
            {formatCurrency(calculo.saldoPendente)}
          </span>
        </div>
      ) : calculo.haver > 0.009 ? (
        <div className="flex justify-between gap-3">
          <span className="text-cyan-300">Haver</span>
          <span className="font-bold text-cyan-400 tabular-nums">
            + {formatCurrency(calculo.haver)}
          </span>
        </div>
      ) : (
        <p className="text-green-400">Quitado</p>
      )}
    </div>
  );
}
