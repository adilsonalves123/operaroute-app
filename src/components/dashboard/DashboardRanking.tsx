import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { Ponto } from "@/lib/types/database";

interface RankingEntry {
  ponto: Ponto;
  valor: number;
}

export function DashboardRanking({
  ranking,
  title = "Ranking do mês",
}: {
  ranking: RankingEntry[];
  title?: string;
}) {
  const total = ranking.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="bank-card p-5 sm:p-6">
      <h3 className="text-sm font-medium text-slate-300">{title}</h3>

      {ranking.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhuma coleta registrada neste período.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {ranking.map(({ ponto, valor }, index) => {
            const pct = total > 0 ? (valor / total) * 100 : 0;
            return (
              <Link
                key={ponto.id}
                href={`/pontos/${ponto.id}`}
                className="group block rounded-lg transition hover:bg-white/[0.02] -mx-2 px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-slate-600">
                      {index + 1}.
                    </span>
                    <span className="truncate text-sm font-medium text-white group-hover:text-primary-neon transition-colors">
                      {ponto.nome}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums text-slate-200">
                      {formatCurrency(valor)}
                    </span>
                    <span className="ml-2 text-[10px] tabular-nums text-slate-600">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 ml-7 h-1 overflow-hidden rounded-full bg-blue-500/10">
                  <div
                    className="h-full rounded-full bg-primary-neon/50 transition-all"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
