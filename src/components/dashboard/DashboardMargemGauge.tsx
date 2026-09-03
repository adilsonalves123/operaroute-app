"use client";

import { cn } from "@/lib/utils";

export function DashboardMargemGauge({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 36;
  const cx = 44;
  const cy = 44;
  const startAngle = Math.PI;
  const endAngle = 0;
  const fillAngle = startAngle - (clamped / 100) * Math.PI;

  const arc = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const large = a0 - a1 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <svg viewBox="0 0 88 52" className="h-14 w-[5.5rem]" aria-hidden>
          <path
            d={arc(startAngle, endAngle)}
            fill="none"
            stroke="var(--at-track)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d={arc(startAngle, fillAngle)}
            fill="none"
            stroke="var(--at-accent)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Margem</p>
        <p className="text-[22px] font-medium tabular-nums leading-none text-at-primary">
          {clamped.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
