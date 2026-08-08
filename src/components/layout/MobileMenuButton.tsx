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
      className="lg:hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
