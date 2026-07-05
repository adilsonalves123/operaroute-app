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
        "glass-card w-full p-4 text-left transition-all hover:border-blue-500/40",
        selected && "border-primary-neon/50 neon-glow bg-blue-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 text-primary-neon">{icon}</div>}
          <div>
            <p className="font-medium text-white">{label}</p>
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
        </div>
        {selected && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-neon text-slate-900">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
    </button>
  );
}
