import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "purple" | "default";

interface AlertBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success:
    "alert-badge-success border bg-emerald-950/20 text-emerald-300/95 border-emerald-500/25",
  danger:
    "alert-badge-danger border bg-rose-950/20 text-rose-300/95 border-rose-500/25",
  warning:
    "alert-badge-warning border bg-amber-950/15 text-amber-200/95 border-amber-500/25",
  info: "alert-badge-info border bg-stone-900/20 text-stone-300/95 border-stone-500/25",
  purple:
    "alert-badge-purple border bg-stone-900/20 text-stone-300/95 border-stone-500/25",
  default: "border border-at bg-at-card-soft text-at-muted",
};

export function AlertBadge({ children, variant = "default", className }: AlertBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
