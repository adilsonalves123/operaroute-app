"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "or_pesquisa_upgrade_dismiss";

type Props = {
  insight: {
    mensagem: string;
    href: string;
    proximoPlanoNome: string | null;
    nichosBloqueados: string[];
  };
  className?: string;
};

export function PesquisaUpgradeBanner({ insight, className }: Props) {
  const [visible, setVisible] = useState(false);
  const dismissToken = insight.nichosBloqueados.slice().sort().join(",");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === dismissToken) {
        setVisible(false);
        return;
      }
    } catch {
      // ignore
    }
    setVisible(true);
  }, [dismissToken]);

  if (!visible) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissToken);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-4 sm:p-5",
        className
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-at-muted hover:bg-white/5 hover:text-at-primary/85"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-8">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300/80">
            Oportunidade · pesquisa
          </p>
          <p className="text-sm leading-relaxed text-at-primary/90">{insight.mensagem}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={insight.href}
              className="inline-flex items-center rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              {insight.proximoPlanoNome
                ? `Ver plano ${insight.proximoPlanoNome}`
                : "Ver planos"}
            </Link>
            <p className="self-center text-[11px] text-at-muted">
              Também usamos isso para promoções futuras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
