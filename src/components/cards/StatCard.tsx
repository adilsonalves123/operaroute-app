import { cn, formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "blue" | "green" | "red" | "orange" | "purple";
  trend?: number;
  prefix?: string;
  isCurrency?: boolean;
}

const colorMap = {
  blue: "text-primary-neon border-blue-500/20",
  green: "text-green-400 border-green-500/20",
  red: "text-red-400 border-red-500/20",
  orange: "text-amber-400 border-amber-500/20",
  purple: "text-purple-400 border-purple-500/20",
};

export function StatCard({
  label,
  value,
  color = "blue",
  trend,
  isCurrency = false,
}: StatCardProps) {
  const displayValue =
    typeof value === "number" && isCurrency ? formatCurrency(value) : value;

  return (
    <div className={cn("glass-card p-5 border", colorMap[color])}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold", colorMap[color].split(" ")[0])}>
        {displayValue}
      </p>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trend >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span className={trend >= 0 ? "text-green-400" : "text-red-400"}>
            {Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );
}
