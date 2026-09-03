"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnaliseVisualTema } from "@/lib/analise/analise-visual-theme";

export function AnaliseThemeToggle({ atual }: { atual: AnaliseVisualTema }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function ir(tema: AnaliseVisualTema) {
    const params = new URLSearchParams(searchParams.toString());
    if (tema === "claro") params.set("tema", "claro");
    else params.delete("tema");
    const qs = params.toString();
    router.push(qs ? `/analise?${qs}` : "/analise");
  }

  return (
    <div
      className="inline-flex rounded-full border border-at p-0.5"
      role="group"
      aria-label="Tema visual da análise"
    >
      <button
        type="button"
        onClick={() => ir("escuro")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
          atual === "escuro" ? "bg-at-tab-active text-at-primary" : "text-at-muted hover:text-at-primary"
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        Escuro
      </button>
      <button
        type="button"
        onClick={() => ir("claro")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
          atual === "claro" ? "bg-at-tab-active text-at-primary" : "text-at-muted hover:text-at-primary"
        )}
      >
        <Sun className="h-3.5 w-3.5" />
        Claro
      </button>
    </div>
  );
}
