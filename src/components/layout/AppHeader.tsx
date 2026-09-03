"use client";

import { LogOut } from "lucide-react";
import { AppThemeToggle } from "@/components/layout/AppThemeToggle";
import { MobileMenuButton } from "@/components/layout/MobileMenuButton";

type Props = {
  nomeUsuario?: string;
};

export function AppHeader({ nomeUsuario }: Props) {
  return (
    <header className="app-shell-header flex h-14 items-center justify-between border-b px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <MobileMenuButton />
        <span
          className="truncate text-[16px] text-[var(--shell-text)] lg:hidden"
          style={{ fontFamily: "Georgia, serif" }}
        >
          OperaRoute
        </span>
        <AppThemeToggle compact className="shrink-0 lg:hidden" />
        <AppThemeToggle className="hidden shrink-0 lg:inline-flex" />
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-[13px] text-[var(--shell-text-muted)] sm:block lg:hidden">
          {nomeUsuario}
        </span>
        <form action="/auth/signout" method="post" className="lg:hidden">
          <button
            type="submit"
            className="rounded-lg p-2 text-[var(--shell-text-muted)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--shell-accent)]"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
