"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/components/layout/MobileMenuContext";

/** Botão hambúrguer no header mobile — abre o mesmo menu do “Mais”. */
export function MobileMenuButton() {
  const { openMenu } = useMobileMenu();
  return (
    <button
      type="button"
      onClick={openMenu}
      className="lg:hidden rounded-lg p-2 text-[var(--shell-text-muted)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
