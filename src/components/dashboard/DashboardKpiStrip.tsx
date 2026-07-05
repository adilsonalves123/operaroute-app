import { cn, formatCurrency } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: number | string;
  highlight?: "warning" | "default";
  isCurrency?: boolean;
}

export function DashboardKpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="bank-card grid grid-cols-2 divide-x divide-blue-500/10 sm:grid-cols-4">
      {items.map((item) => {
        const display =
          typeof item.value === "number" && item.isCurrency
            ? formatCurrency(item.value)
            : item.value;

        return (
          <div key={item.label} className="px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
              {item.label}
            </p>
            <p
              className={cn(
                "mt-1.5 text-xl font-semibold tabular-nums tracking-tight",
                item.highlight === "warning" && Number(item.value) > 0
                  ? "text-red-400"
                  : "text-white"
              )}
            >
              {display}
            </p>
          </div>
        );
      })}
    </div>
  );
}
