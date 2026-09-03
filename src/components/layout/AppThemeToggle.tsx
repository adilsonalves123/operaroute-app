"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTheme, type AppTheme } from "@/components/layout/AppTheme";

type Props = {
  /** Compacto para cabeçalho mobile / sidebar colapsada */
  compact?: boolean;
  className?: string;
};

export function AppThemeToggle({ compact = false, className }: Props) {
  const { theme, setTheme, ready } = useAppTheme();

  function ir(t: AppTheme) {
    setTheme(t);
  }

  if (!ready) {
    return (
      <div
        className={cn(
          "inline-flex rounded-full border border-[var(--shell-border)] p-0.5 opacity-0",
          compact ? "h-7 w-[4.5rem]" : "h-8 w-[5.5rem]",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] p-0.5",
        className
      )}
      role="group"
      aria-label="Tema visual"
    >
      <button
        type="button"
        onClick={() => ir("dark")}
        title="Tema escuro"
        className={cn(
          "inline-flex items-center justify-center rounded-full transition",
          compact ? "h-6 w-6" : "gap-1 px-2.5 py-1 text-[11px] font-medium",
          theme === "dark"
            ? "bg-[var(--shell-tab-active-bg)] text-[var(--shell-tab-active-text)]"
            : "text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]"
        )}
      >
        <Moon className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {!compact && <span>Escuro</span>}
      </button>
      <button
        type="button"
        onClick={() => ir("light")}
        title="Tema claro"
        className={cn(
          "inline-flex items-center justify-center rounded-full transition",
          compact ? "h-6 w-6" : "gap-1 px-2.5 py-1 text-[11px] font-medium",
          theme === "light"
            ? "bg-[var(--shell-tab-active-bg)] text-[var(--shell-tab-active-text)]"
            : "text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]"
        )}
      >
        <Sun className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {!compact && <span>Claro</span>}
      </button>
    </div>
  );
}
