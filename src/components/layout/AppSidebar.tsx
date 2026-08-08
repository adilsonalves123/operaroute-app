"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SIDEBAR_COLLAPSED_KEY } from "@/components/layout/nav-items";
import {
  AppNavLinks,
  appNavDisplayFont,
  appNavSansFont,
} from "@/components/layout/AppNavLinks";
import { Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

interface AppSidebarProps {
  nomeOperacao?: string;
  chamadosAbertos?: number;
  nomeUsuario?: string;
}

export function AppSidebar({
  nomeOperacao,
  chamadosAbertos = 0,
  nomeUsuario,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        appNavDisplayFont.variable,
        appNavSansFont.variable,
        "hidden lg:flex shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0e16]/90 backdrop-blur-md transition-all duration-300",
        ready && collapsed ? "w-[68px]" : "w-[240px]"
      )}
      style={{ fontFamily: "var(--font-app-nav-sans), system-ui, sans-serif" }}
    >
      <div
        className={cn(
          "flex gap-2",
          collapsed
            ? "flex-col items-center px-2 py-4"
            : "items-start justify-between px-4 py-5"
        )}
      >
        {!collapsed ? (
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c4a574]/20 text-[#c4a574]">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-[17px] leading-none tracking-tight text-[#f4efe6]"
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
        ) : (
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c4a574]/20 text-[#c4a574]"
            title={nomeOperacao ?? "OperaRoute"}
          >
            <Layers className="h-4 w-4" />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.05] hover:text-[#c4a574]"
          title={collapsed ? "Expandir menu" : "Minimizar menu"}
          aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <AppNavLinks collapsed={collapsed} chamadosAbertos={chamadosAbertos} />
      </nav>

      {!collapsed && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          {nomeUsuario && (
            <p className="truncate text-[12px] text-slate-500">{nomeUsuario}</p>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="mt-1.5 text-[12px] text-slate-500 transition hover:text-[#c4a574]"
            >
              Sair da conta
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
