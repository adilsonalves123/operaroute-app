import Link from "next/link";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  MapPin,
  Package,
  Route,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Package,
  MapPin,
  Route,
  Activity,
  Wallet,
  ClipboardCheck,
  UserPlus,
  BarChart3,
};

interface QuickAction {
  label: string;
  href: string;
  icon?: string;
}

export function DashboardCommandBar({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  const [primary, ...secondary] = actions;
  const PrimaryIcon = iconMap[primary.icon ?? "Package"] ?? Package;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={primary.href}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-lg px-5 py-2.5",
          "bg-primary-neon text-slate-900 font-semibold text-sm",
          "transition hover:bg-cyan-300 active:scale-[0.98]"
        )}
      >
        <PrimaryIcon className="h-4 w-4" />
        {primary.label}
      </Link>
      {secondary.map((action) => {
        const Icon = iconMap[action.icon ?? "Package"] ?? Package;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2.5",
              "text-sm text-slate-400 border border-blue-500/20",
              "transition hover:border-primary-neon/30 hover:text-slate-200 hover:bg-blue-500/5"
            )}
          >
            <Icon className="h-3.5 w-3.5 opacity-70" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
