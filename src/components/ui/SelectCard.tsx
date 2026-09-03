"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SelectCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function SelectCard({ label, description, selected, onClick, icon }: SelectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-at bg-at-card p-4 text-left transition-all hover:border-[#c4a574]/35",
        selected && "border-[#c4a574]/45 bg-[#c4a574]/[0.06] ring-1 ring-[#c4a574]/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-at-soft bg-at-card-soft text-at-link">
              {icon}
            </div>
          )}
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-at-primary">{label}</p>
            {description && <p className="mt-1 text-sm text-at-muted">{description}</p>}
          </div>
        </div>
        {selected && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c4a574] text-[#0a0e16]">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
    </button>
  );
}
