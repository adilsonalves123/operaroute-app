"use client";

import { useId, useMemo, useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import type { AnaliseVisualTema } from "@/lib/analise/analise-visual-theme";

type Props = {
  values: number[];
  className?: string;
  tema?: AnaliseVisualTema;
};

type DayLabel = { short: string; full: string };

function dayLabels(count: number): DayLabel[] {
  const labels: DayLabel[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const raw = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    labels.push({
      short: raw.slice(0, 3).toUpperCase(),
      full: d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
    });
  }
  return labels;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function DashboardBarChart7d({ values, className, tema = "escuro" }: Props) {
  const uid = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<number | null>(null);
  const labels = useMemo(() => dayLabels(values.length), [values.length]);
  const claro = tema === "claro";

  const chart = useMemo(() => {
    const w = 100;
    const h = 32;
    const padX = 0;
    const padTop = 3;
    const padBottom = 2;
    const plotH = h - padTop - padBottom;

    const max = Math.max(...values.map((v) => Math.abs(v)), 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, max * 0.06, 1);
    const step = values.length > 1 ? w / (values.length - 1) : 0;

    const pts = values.map((v, i) => ({
      x: padX + i * step,
      y: padTop + plotH - ((v - min) / span) * plotH,
      v,
      i,
    }));

    const linePath = buildSmoothPath(pts);
    const baseY = padTop + plotH;
    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
        : "";

    return { w, h, padTop, baseY, pts, linePath, areaPath };
  }, [values]);

  if (values.length < 2) return null;

  const lineGrad = `or7d-line-${uid}`;
  const areaGrad = `or7d-area-${uid}`;
  const active = hovered;
  const activePt = active != null ? chart.pts[active] : null;

  return (
    <div
      className={cn("or7d-chart w-full select-none", className)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          preserveAspectRatio="none"
          className="block h-[4.5rem] w-full"
          role="img"
          aria-label="Gráfico dos últimos 7 dias"
        >
          <defs>
            <linearGradient id={lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={claro ? "#047857" : "#34d399"} />
              <stop offset="50%" stopColor={claro ? "#0e7490" : "#22d3ee"} />
              <stop offset="100%" stopColor={claro ? "#92662a" : "#c4a574"} />
            </linearGradient>
            <linearGradient id={areaGrad} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={claro ? "#047857" : "#34d399"} stopOpacity={claro ? 0.16 : 0.26} />
              <stop offset="100%" stopColor={claro ? "#92662a" : "#c4a574"} stopOpacity={0} />
            </linearGradient>
          </defs>

          {[0.5].map((t) => (
            <line
              key={t}
              x1={0}
              y1={chart.padTop + (chart.baseY - chart.padTop) * (1 - t)}
              x2={chart.w}
              y2={chart.padTop + (chart.baseY - chart.padTop) * (1 - t)}
              stroke={claro ? "rgba(28,25,23,0.06)" : "rgba(255,255,255,0.05)"}
              strokeWidth={0.12}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={chart.areaPath} fill={`url(#${areaGrad})`} />
          <path
            d={chart.linePath}
            fill="none"
            stroke={`url(#${lineGrad})`}
            strokeWidth={0.32}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {chart.pts.map((p) => {
            const isActive = p.i === active;
            const isLast = p.i === chart.pts.length - 1;

            return (
              <g key={p.i}>
                <rect
                  x={p.x - chart.w / values.length / 2}
                  y={0}
                  width={chart.w / values.length}
                  height={chart.h}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(p.i)}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 0.5 : isLast ? 0.38 : 0.28}
                  fill={claro ? (isActive ? "#047857" : "#faf8f4") : isActive ? "#34d399" : "#0a0e16"}
                  stroke={claro ? "#047857" : "#34d399"}
                  strokeWidth={isActive ? 0.18 : 0.12}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {activePt && (
            <line
              x1={activePt.x}
              y1={chart.padTop}
              x2={activePt.x}
              y2={chart.baseY}
              stroke={claro ? "rgba(146,102,42,0.28)" : "rgba(196,165,116,0.28)"}
              strokeWidth={0.1}
              strokeDasharray="0.35 0.35"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {activePt && active != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border px-2 py-1 text-center shadow-sm"
            style={{
              left: `${(active / Math.max(values.length - 1, 1)) * 100}%`,
              top: `${Math.max(((activePt.y - chart.padTop) / (chart.baseY - chart.padTop)) * 100 - 18, 0)}%`,
              borderColor: claro ? "rgba(146,102,42,0.35)" : "rgba(196,165,116,0.3)",
              background: claro ? "rgba(28,25,23,0.92)" : "rgba(10,14,22,0.92)",
            }}
          >
            <p className="text-[10px] font-semibold tabular-nums text-white">
              {formatCurrency(activePt.v)}
            </p>
            <p className="text-[9px] capitalize text-stone-400">{labels[active]?.full}</p>
          </div>
        )}
      </div>

      <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {labels.map((label, i) => (
          <button
            key={label.short}
            type="button"
            className={cn(
              "py-0.5 text-center text-[9px] font-medium uppercase tracking-wide transition-colors",
              i === active
                ? claro
                  ? "text-[#78520a]"
                  : "text-[#c4a574]"
                : "text-at-soft"
            )}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
          >
            {label.short}
          </button>
        ))}
      </div>
    </div>
  );
}
