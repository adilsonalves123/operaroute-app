import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "purple" | "default";

interface AlertBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: "bg-green-500/15 text-green-400 border-green-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  default: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function AlertBadge({ children, variant = "default", className }: AlertBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
