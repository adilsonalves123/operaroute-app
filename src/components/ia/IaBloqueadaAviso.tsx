"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import type { IaLeituraFotoInfo } from "@/components/layout/PermissoesProvider";
import { cn } from "@/lib/utils";

type Props = {
  info: IaLeituraFotoInfo;
  compacto?: boolean;
  className?: string;
};

export function IaBloqueadaAviso({ info, compacto = false, className }: Props) {
  const planoAtual = info.planoAtual ? `No ${info.planoAtual}` : "No seu plano";

  if (compacto) {
    return (
      <p className={cn("text-[11px] leading-snug text-slate-400", className)}>
        <Lock className="mr-1 inline h-3 w-3 -translate-y-px text-cyan-400/80" />
        Leitura por foto com IA é dos planos {info.planosComIa}.{" "}
        <Link href="/planos" className="font-medium text-cyan-300 underline-offset-2 hover:underline">
          Ver planos
        </Link>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3.5 py-3",
        className
      )}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15">
        <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-cyan-100">
          Leitura automática por foto é dos planos {info.planosComIa}
        </p>
        <p className="text-[11px] leading-snug text-slate-400">
          {planoAtual} você digita entrada e saída normalmente. Com IA, a foto do visor já
          preenche os números sozinha.
        </p>
        <Link
          href="/planos"
          className="inline-flex text-[11px] font-semibold text-cyan-300 underline-offset-2 hover:underline"
        >
          Fazer upgrade
        </Link>
      </div>
    </div>
  );
}
