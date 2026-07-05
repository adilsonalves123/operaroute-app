"use client";

interface DashboardSparklineProps {
  values: number[];
}

export function DashboardSparkline({ values }: DashboardSparklineProps) {
  const max = Math.max(...values, 1);
  const w = 160;
  const h = 48;
  const pad = 2;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;

  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full max-w-[176px] text-primary-neon"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.85}
      />
      {values.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - (v / max) * (h - pad * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === values.length - 1 ? 2.5 : 1.5}
            fill="currentColor"
            opacity={i === values.length - 1 ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}
