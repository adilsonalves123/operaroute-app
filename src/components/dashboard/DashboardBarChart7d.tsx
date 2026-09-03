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

  const chart = useMemo(() => {
    const w = 400;
    const h = 112;
    const padX = 14;
    const padTop = 14;
    const padBottom = 22;
    const plotH = h - padTop - padBottom;

    const max = Math.max(...values.map((v) => Math.abs(v)), 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, max * 0.08, 1);
    const step = values.length > 1 ? (w - padX * 2) / (values.length - 1) : 0;

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

    const peakIndex = values.reduce(
      (best, v, i) => (Math.abs(v) > Math.abs(values[best]) ? i : best),
      0
    );

    const gridLines = [0.25, 0.5, 0.75].map((t) => padTop + plotH * (1 - t));

    return { w, h, padX, padTop, padBottom, plotH, baseY, pts, linePath, areaPath, peakIndex, gridLines, max, min, span };
  }, [values]);

  if (values.length < 2) return null;

  const lineGrad = `or7d-line-${uid}`;
  const areaGrad = `or7d-area-${uid}`;
  const glowFilter = `or7d-glow-${uid}`;
  const meshGrad = `or7d-mesh-${uid}`;
  const active = hovered ?? chart.peakIndex;
  const activePt = chart.pts[active];
  const total = values.reduce((s, v) => s + v, 0);
  const claro = tema === "claro";

  return (
    <div className={cn("or7d-chart w-full select-none", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-1.5 w-1.5 rounded-full",
              claro ? "bg-emerald-600 shadow-[0_0_6px_rgba(4,120,87,0.45)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            )}
            aria-hidden
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-at-muted">
            Fluxo diário
          </span>
        </div>
        <p className="text-[12px] font-semibold tabular-nums text-at-link">{formatCurrency(total)}</p>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border",
          claro
            ? "border-stone-200/90 bg-gradient-to-b from-white via-stone-50/80 to-stone-100/60"
            : "border-at-soft bg-gradient-to-b from-[rgba(8,12,20,0.6)] via-[rgba(6,10,18,0.85)] to-[rgba(4,8,14,0.95)]"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: claro
              ? "radial-gradient(circle at 20% 0%, rgba(146,102,42,0.08), transparent 45%), radial-gradient(circle at 85% 100%, rgba(14,116,144,0.1), transparent 50%)"
              : "radial-gradient(circle at 15% 0%, rgba(196,165,116,0.12), transparent 40%), radial-gradient(circle at 90% 100%, rgba(0,212,255,0.08), transparent 45%)",
          }}
          aria-hidden
        />

        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          className="relative z-[1] block h-[7rem] max-h-[7rem] w-full"
          role="img"
          aria-label="Gráfico dos últimos 7 dias"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id={lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={claro ? "#047857" : "#34d399"} />
              <stop offset="45%" stopColor={claro ? "#0e7490" : "#22d3ee"} />
              <stop offset="100%" stopColor={claro ? "#92662a" : "#e8d5b0"} />
            </linearGradient>
            <linearGradient id={areaGrad} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={claro ? "#047857" : "#34d399"} stopOpacity={claro ? 0.22 : 0.35} />
              <stop offset="55%" stopColor={claro ? "#0e7490" : "#22d3ee"} stopOpacity={claro ? 0.1 : 0.14} />
              <stop offset="100%" stopColor={claro ? "#92662a" : "#c4a574"} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={meshGrad} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={claro ? "#047857" : "#34d399"} stopOpacity={0.04} />
              <stop offset="100%" stopColor={claro ? "#92662a" : "#c4a574"} stopOpacity={0.06} />
            </linearGradient>
            <filter id={glowFilter} x="-30%" y="-50%" width="160%" height="200%">
              <feGaussianBlur stdDeviation={claro ? 2 : 3} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x={0} y={0} width={chart.w} height={chart.h} fill={`url(#${meshGrad})`} />

          {chart.gridLines.map((y, i) => (
            <line
              key={i}
              x1={chart.padX}
              y1={y}
              x2={chart.w - chart.padX}
              y2={y}
              stroke={claro ? "rgba(28,25,23,0.07)" : "rgba(255,255,255,0.06)"}
              strokeWidth={1}
              strokeDasharray={i === 1 ? "0" : "4 6"}
            />
          ))}

          {activePt && (
            <line
              x1={activePt.x}
              y1={chart.padTop}
              x2={activePt.x}
              y2={chart.baseY}
              stroke={claro ? "rgba(146,102,42,0.35)" : "rgba(196,165,116,0.35)"}
              strokeWidth={1}
              strokeDasharray="3 4"
              className="or7d-crosshair"
            />
          )}

          <path d={chart.areaPath} fill={`url(#${areaGrad})`} className="or7d-area" />
          <path
            d={chart.linePath}
            fill="none"
            stroke={`url(#${lineGrad})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowFilter})`}
            className="or7d-line"
          />

          {chart.pts.map((p) => {
            const isActive = p.i === active;
            const isPeak = p.i === chart.peakIndex;
            const isLast = p.i === chart.pts.length - 1;
            const r = isActive ? 4 : isPeak ? 3.2 : isLast ? 2.8 : 2;

            return (
              <g key={p.i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 9 : 0}
                  fill={claro ? "rgba(4,120,87,0.08)" : "rgba(52,211,153,0.1)"}
                  className="transition-all duration-200"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={claro ? (isActive ? "#047857" : "#faf8f4") : isActive ? "#34d399" : "#0a0e16"}
                  stroke={claro ? "#047857" : isActive ? "#e8d5b0" : "#34d399"}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className={cn(isLast && "or7d-pulse", "transition-all duration-200")}
                />
                <rect
                  x={p.x - 24}
                  y={0}
                  width={48}
                  height={chart.h}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHovered(p.i)}
                />
              </g>
            );
          })}

          {activePt && (
            <g className="or7d-tooltip" transform={`translate(${Math.min(Math.max(activePt.x, 48), chart.w - 48)}, ${Math.max(activePt.y - 10, 14)})`}>
              <rect
                x={-44}
                y={-18}
                width={88}
                height={30}
                rx={6}
                fill={claro ? "rgba(28,25,23,0.92)" : "rgba(10,14,22,0.92)"}
                stroke={claro ? "rgba(146,102,42,0.45)" : "rgba(196,165,116,0.35)"}
                strokeWidth={1}
              />
              <text
                x={0}
                y={-8}
                textAnchor="middle"
                fill={claro ? "#faf8f4" : "#f4efe6"}
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {formatCurrency(activePt.v)}
              </text>
              <text
                x={0}
                y={5}
                textAnchor="middle"
                fill={claro ? "#a8a29e" : "#94a3b8"}
                style={{ fontSize: 8, textTransform: "capitalize" }}
              >
                {labels[active]?.full ?? ""}
              </text>
            </g>
          )}

          {chart.pts.map((p, i) => (
            <text
              key={`lbl-${i}`}
              x={p.x}
              y={chart.h - 8}
              textAnchor="middle"
              fill={i === active ? (claro ? "#78520a" : "#c4a574") : claro ? "#78716c" : "#64748b"}
              style={{
                fontSize: 9,
                fontWeight: i === active ? 700 : 500,
                letterSpacing: "0.06em",
              }}
            >
              {labels[i]?.short ?? ""}
            </text>
          ))}
        </svg>

        <div
          className={cn(
            "or7d-scan pointer-events-none absolute inset-x-0 top-0 h-px",
            claro ? "bg-gradient-to-r from-transparent via-emerald-600/40 to-transparent" : "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
          )}
          aria-hidden
        />
      </div>

      <style>{`
        .or7d-line {
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: or7dDraw 1.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .or7d-area {
          opacity: 0;
          animation: or7dFade 1s 0.2s ease-out forwards;
        }
        .or7d-crosshair {
          opacity: 0;
          animation: or7dFade 0.25s ease-out forwards;
        }
        .or7d-tooltip {
          animation: or7dFade 0.2s ease-out forwards;
        }
        .or7d-pulse {
          transform-box: fill-box;
          transform-origin: center;
          animation: or7dPulse 2.8s ease-in-out infinite;
        }
        .or7d-scan {
          animation: or7dScan 4.5s linear infinite;
        }
        @keyframes or7dDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes or7dFade {
          to { opacity: 1; }
        }
        @keyframes or7dPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes or7dScan {
          0% { transform: translateY(0); opacity: 0; }
          8% { opacity: 0.7; }
          92% { opacity: 0.7; }
          100% { transform: translateY(112px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
