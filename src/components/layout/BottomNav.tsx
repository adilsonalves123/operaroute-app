"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/components/layout/PermissoesProvider";
import { MOBILE_TAB_ITEMS } from "@/components/layout/nav-items";
import { useMobileMenu } from "@/components/layout/MobileMenuContext";

export function BottomNav() {
  const pathname = usePathname();
  const { podeVer } = usePermissoes();
  const { open, openMenu, closeMenu } = useMobileMenu();

  const visiveis = MOBILE_TAB_ITEMS.filter((item) => podeVer(item.modulo));

  return (
    <nav className="app-shell-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around px-1 py-2">
        {visiveis.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => closeMenu()}
              className={cn(
                "flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition",
                active ? "text-[var(--shell-accent)]" : "text-[var(--shell-text-muted)]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => (open ? closeMenu() : openMenu())}
          className={cn(
            "flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition",
            open ? "text-[var(--shell-accent)]" : "text-[var(--shell-text-muted)]"
          )}
          aria-expanded={open}
          aria-label="Abrir menu completo"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </div>
    </nav>
  );
}
