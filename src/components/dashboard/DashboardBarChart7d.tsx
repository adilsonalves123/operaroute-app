"use client";

import { useId, useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  values: number[];
  className?: string;
};

function dayLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const raw = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    labels.push(raw.charAt(0).toUpperCase() + raw.slice(1, 3));
  }
  return labels;
}

export function DashboardBarChart7d({ values, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const labels = useMemo(() => dayLabels(values.length), [values.length]);
  const max = useMemo(() => Math.max(...values.map((v) => Math.abs(v)), 1), [values]);

  if (values.length < 2) return null;

  const peakIndex = values.reduce(
    (best, v, i) => (Math.abs(v) > Math.abs(values[best]) ? i : best),
    0
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-44 items-end justify-between gap-1.5 sm:gap-2">
        {values.map((v, i) => {
          const height = Math.max(8, (Math.abs(v) / max) * 100);
          const positive = v >= 0;
          const showValue = i === peakIndex || values.length <= 4;

          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center">
              {showValue && (
                <p
                  className={cn(
                    "mb-1.5 max-w-full truncate text-[9px] tabular-nums sm:text-[10px]",
                    positive ? "text-emerald-400/85" : "text-rose-400/85"
                  )}
                >
                  {formatCurrency(v)}
                </p>
              )}
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="mx-auto w-full max-w-[2.25rem] rounded-t-md transition-all duration-700"
                  style={{
                    height: `${height}%`,
                    background: positive
                      ? `linear-gradient(180deg, rgba(52,211,153,0.95) 0%, rgba(16,185,129,0.35) 55%, rgba(16,185,129,0.08) 100%)`
                      : `linear-gradient(180deg, rgba(251,113,133,0.9) 0%, rgba(251,113,133,0.25) 100%)`,
                    boxShadow: positive
                      ? "0 -4px 20px rgba(16,185,129,0.15)"
                      : "0 -4px 16px rgba(251,113,133,0.12)",
                  }}
                />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-600">
                {labels[i]}
              </p>
            </div>
          );
        })}
      </div>
      <svg width="0" height="0" aria-hidden>
        <defs>
          <linearGradient id={`barGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
