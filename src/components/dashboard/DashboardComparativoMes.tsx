import { formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  lucroAtual: number;
  lucroAnterior: number;
  coletasAtual: number;
  coletasAnterior: number;
};

export function DashboardComparativoMes({
  lucroAtual,
  lucroAnterior,
  coletasAtual,
  coletasAnterior,
}: Props) {
  const deltaLucro =
    lucroAnterior > 0.009
      ? Math.round(((lucroAtual - lucroAnterior) / lucroAnterior) * 1000) / 10
      : null;

  const Icon =
    deltaLucro == null ? Minus : deltaLucro >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="glass-card flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">vs mês anterior</p>
        <p className="font-semibold text-white tabular-nums mt-0.5">
          Lucro {formatCurrency(lucroAtual)}
        </p>
        <p className="text-xs text-slate-500">
          Mês passado: {formatCurrency(lucroAnterior)}
        </p>
      </div>
      {deltaLucro != null && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            deltaLucro >= 0
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {deltaLucro >= 0 ? "+" : ""}
          {deltaLucro}% lucro
        </div>
      )}
      <div className="text-xs text-slate-500">
        Coletas: <span className="text-slate-300">{coletasAtual}</span>
        {coletasAnterior > 0 && (
          <>
            {" "}
            (antes: {coletasAnterior})
          </>
        )}
      </div>
    </div>
  );
}
