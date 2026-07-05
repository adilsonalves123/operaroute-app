import { formatCurrency } from "@/lib/utils";
import { DashboardSparkline } from "./DashboardSparkline";

interface DashboardHeroProps {
  saldo: number;
  entrada?: number;
  saida?: number;
  periodLabel: string;
  nichoLabel: string;
  sparkline?: number[];
}

function marginPct(entrada: number, saldo: number): string | null {
  if (entrada <= 0.009) return null;
  return `${((saldo / entrada) * 100).toFixed(1).replace(".", ",")}%`;
}

export function DashboardHero({
  saldo,
  entrada,
  saida,
  periodLabel,
  nichoLabel,
  sparkline = [],
}: DashboardHeroProps) {
  const margem = entrada !== undefined ? marginPct(entrada, saldo) : null;

  return (
    <div className="bank-card dashboard-hero relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-neon/5 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="uppercase tracking-[0.14em]">{nichoLabel}</span>
            <span className="text-slate-700">·</span>
            <span>{periodLabel}</span>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Saldo líquido do período
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-primary-neon sm:text-5xl">
              {formatCurrency(saldo)}
            </p>
          </div>

          {(entrada !== undefined || saida !== undefined) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {entrada !== undefined && (
                <div>
                  <span className="text-slate-500">Entrada </span>
                  <span className="font-medium tabular-nums text-green-400">
                    {formatCurrency(entrada)}
                  </span>
                </div>
              )}
              {saida !== undefined && (
                <div>
                  <span className="text-slate-500">Saída </span>
                  <span className="font-medium tabular-nums text-red-400">
                    {formatCurrency(saida)}
                  </span>
                </div>
              )}
              {margem && (
                <div>
                  <span className="text-slate-500">Margem </span>
                  <span className="font-medium tabular-nums text-primary-neon">
                    {margem}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {sparkline.length > 1 && (
          <div className="shrink-0 lg:w-44">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-600">Últimos 7 dias</p>
            <DashboardSparkline values={sparkline} />
          </div>
        )}
      </div>
    </div>
  );
}
