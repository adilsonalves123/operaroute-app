import Link from "next/link";
import { cn } from "@/lib/utils";
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

interface ActionCardProps {
  label: string;
  href: string;
  icon?: string;
}

export function ActionCard({ label, href, icon = "Package" }: ActionCardProps) {
  const Icon = iconMap[icon] ?? Package;

  return (
    <Link
      href={href}
      className={cn(
        "glass-card flex flex-col items-center justify-center gap-2 p-4",
        "transition hover:border-primary-neon/40 hover:bg-blue-500/5"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-primary-neon">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-slate-300 text-center">{label}</span>
    </Link>
  );
}
