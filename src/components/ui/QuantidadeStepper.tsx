"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  /** Esconde o texto "Máximo" (útil quando o botão ao lado precisa alinhar). */
  hideMaxHint?: boolean;
  className?: string;
};

export function QuantidadeStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  label,
  hideMaxHint,
  className,
}: Props) {
  const clampedMax = Math.max(min, max);
  const safe = Math.min(clampedMax, Math.max(min, value));

  function setNext(next: number) {
    onChange(Math.min(clampedMax, Math.max(min, next)));
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs text-at-muted leading-4">{label}</p>}
      <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/50 px-1">
        <button
          type="button"
          disabled={disabled || safe <= min}
          onClick={() => setNext(safe - 1)}
          aria-label="Diminuir quantidade"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-at-primary/85",
            "hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2.5rem] text-center text-sm font-semibold text-white tabular-nums">
          {safe}
        </span>
        <button
          type="button"
          disabled={disabled || safe >= clampedMax}
          onClick={() => setNext(safe + 1)}
          aria-label="Aumentar quantidade"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-at-primary/85",
            "hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {!hideMaxHint && clampedMax > 0 && (
        <p className="text-[10px] leading-4 text-at-soft">Máximo: {clampedMax}</p>
      )}
    </div>
  );
}
