"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/components/layout/PermissoesProvider";
import {
  APP_NAV_BOTTOM,
  APP_NAV_MAIN,
  type AppNavItem,
} from "@/components/layout/nav-items";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-app-nav-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-app-nav-sans",
});

type Props = {
  collapsed?: boolean;
  chamadosAbertos?: number;
  onNavigate?: () => void;
  /** Só tipografia/classes — o wrapper externo aplica as CSS vars. */
  bare?: boolean;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinkRow({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: AppNavItem;
  active: boolean;
  collapsed?: boolean;
  badge?: string | null;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const temAlertas = Boolean(badge);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={
        collapsed
          ? badge
            ? `${item.label} (${badge})`
            : item.label
          : undefined
      }
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
        collapsed && "justify-center px-2",
        temAlertas &&
          !active &&
          "bg-orange-500/15 text-orange-300 hover:bg-orange-500/25",
        temAlertas &&
          active &&
          "bg-orange-500/25 font-medium text-orange-200 ring-1 ring-orange-500/40",
        !temAlertas &&
          active &&
          "bg-[#c4a574]/15 font-medium text-[#e8d5b0]",
        !temAlertas &&
          !active &&
          "text-slate-400 hover:bg-white/[0.04] hover:text-[#f4efe6]"
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            "h-4 w-4 opacity-80",
            temAlertas && "text-orange-400 opacity-100"
          )}
        />
        {collapsed && badge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-orange-500 px-0.5 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {badge && (
            <span className="ml-auto rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-rose-200">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export { display as appNavDisplayFont, sans as appNavSansFont };

/** Links no padrão Auditoria / painel dono (champagne + Outfit). */
export function AppNavLinks({
  collapsed = false,
  chamadosAbertos = 0,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const { podeVer } = usePermissoes();
  const badgeCount =
    chamadosAbertos > 99 ? "99+" : chamadosAbertos > 0 ? String(chamadosAbertos) : null;

  const main = APP_NAV_MAIN.filter((item) => podeVer(item.modulo));
  const bottom = APP_NAV_BOTTOM.filter((item) => podeVer(item.modulo));

  function renderItem(item: AppNavItem) {
    const active = isActive(pathname, item.href);
    const isManutencao = item.href === "/chamados";
    return (
      <NavLinkRow
        key={item.href}
        item={item}
        active={active}
        collapsed={collapsed}
        badge={isManutencao ? badgeCount : null}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-app-nav-sans), system-ui, sans-serif" }}
    >
      <div className="space-y-0.5">{main.map(renderItem)}</div>
      {bottom.length > 0 && (
        <div
          className={cn(
            "mt-6 space-y-0.5 border-t border-white/[0.06] pt-4",
            collapsed && "mt-4 pt-3"
          )}
        >
          {bottom.map(renderItem)}
        </div>
      )}
    </div>
  );
}
