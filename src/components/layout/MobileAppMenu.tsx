"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Layers } from "lucide-react";
import {
  AppNavLinks,
  appNavDisplayFont,
  appNavSansFont,
} from "@/components/layout/AppNavLinks";
import { useMobileMenu } from "@/components/layout/MobileMenuContext";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type Props = {
  nomeOperacao?: string;
  chamadosAbertos?: number;
};

/** Drawer mobile — mesmo padrão champagne da sidebar / Auditoria / dono. */
export function MobileAppMenu({ nomeOperacao, chamadosAbertos = 0 }: Props) {
  const pathname = usePathname();
  const { open, closeMenu } = useMobileMenu();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar menu"
        onClick={closeMenu}
      />
      <div
        className={cn(
          appNavDisplayFont.variable,
          appNavSansFont.variable,
          "absolute inset-y-0 left-0 flex w-[min(100%,260px)] flex-col border-r border-white/[0.06] bg-[#0a0e16] shadow-2xl"
        )}
        style={{ fontFamily: "var(--font-app-nav-sans), system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            onClick={closeMenu}
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c4a574]/20 text-[#c4a574]">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-[17px] leading-none text-[#f4efe6]"
                style={{
                  fontFamily: "var(--font-app-nav-display), Georgia, serif",
                }}
              >
                OperaRoute
              </p>
              <p className="mt-1.5 truncate text-[11px] text-slate-500">
                {nomeOperacao?.trim() || "Sua operação"}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={closeMenu}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-[#c4a574]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-24">
          <AppNavLinks
            chamadosAbertos={chamadosAbertos}
            onNavigate={closeMenu}
          />
        </nav>
      </div>
    </div>
  );
}
