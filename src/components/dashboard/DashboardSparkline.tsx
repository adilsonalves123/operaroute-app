"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

interface DashboardSparklineProps {
  values: number[];
  className?: string;
  /** Altura visual maior (dashboard / destaque). */
  size?: "sm" | "lg";
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

export function DashboardSparkline({
  values,
  className,
  size = "sm",
}: DashboardSparklineProps) {
  const uid = useId().replace(/:/g, "");
  const w = size === "lg" ? 320 : 200;
  const h = size === "lg" ? 96 : 56;
  const padX = 6;
  const padY = 8;

  const { linePath, areaPath, dots, last } = useMemo(() => {
    const max = Math.max(...values.map((v) => Math.abs(v)), 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    const step = values.length > 1 ? (w - padX * 2) / (values.length - 1) : 0;

    const pts = values.map((v, i) => ({
      x: padX + i * step,
      y: h - padY - ((v - min) / span) * (h - padY * 2),
      v,
    }));

    const line = buildSmoothPath(pts);
    const baseY = h - padY;
    const area =
      pts.length > 0
        ? `${line} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
        : "";

    return {
      linePath: line,
      areaPath: area,
      dots: pts,
      last: pts[pts.length - 1],
    };
  }, [values, w, h, padX, padY]);

  if (values.length < 2) return null;

  const gradId = `or-spark-grad-${uid}`;
  const fillId = `or-spark-fill-${uid}`;
  const glowId = `or-spark-glow-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn(
        size === "lg" ? "w-full max-w-md" : "w-full max-w-[220px]",
        className
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a8895a" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#c4a574" stopOpacity="1" />
          <stop offset="100%" stopColor="#e8d5b0" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c4a574" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#c4a574" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#c4a574" stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base suave */}
      <line
        x1={padX}
        y1={h - padY}
        x2={w - padX}
        y2={h - padY}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />

      <path d={areaPath} fill={`url(#${fillId})`} className="or-spark-area" />

      <path
        d={linePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={size === "lg" ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        className="or-spark-line"
      />

      {dots.map((p, i) => {
        const isLast = i === dots.length - 1;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isLast ? (size === "lg" ? 4 : 3.2) : size === "lg" ? 2 : 1.6}
            fill={isLast ? "#e8d5b0" : "rgba(196,165,116,0.55)"}
            stroke={isLast ? "rgba(232,213,176,0.35)" : "none"}
            strokeWidth={isLast ? 4 : 0}
            className={isLast ? "or-spark-pulse" : undefined}
          />
        );
      })}

      {last && (
        <text
          x={Math.min(last.x, w - 8)}
          y={Math.max(12, last.y - 10)}
          textAnchor={last.x > w * 0.7 ? "end" : "start"}
          className="fill-[#e8d5b0]/90"
          style={{ fontSize: size === "lg" ? 11 : 9, fontWeight: 500 }}
        >
          {last.v.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })}
        </text>
      )}

      <style>{`
        .or-spark-line {
          stroke-dasharray: 480;
          stroke-dashoffset: 480;
          animation: orSparkDraw 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .or-spark-area {
          opacity: 0;
          animation: orSparkFade 0.9s 0.25s ease-out forwards;
        }
        .or-spark-pulse {
          transform-box: fill-box;
          transform-origin: center;
          animation: orSparkPulse 2.4s ease-in-out infinite;
        }
        @keyframes orSparkDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes orSparkFade {
          to { opacity: 1; }
        }
        @keyframes orSparkPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </svg>
  );
}
