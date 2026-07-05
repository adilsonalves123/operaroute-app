"use client";

import { daysUntil } from "@/lib/utils";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { useState } from "react";

interface TrialBannerProps {
  trialFim: string | null;
  assinaturaAtiva: boolean;
}

export function TrialBanner({ trialFim, assinaturaAtiva }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || assinaturaAtiva || !trialFim) return null;

  const days = daysUntil(trialFim);
  const expired = days === 0;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
        expired
          ? "bg-red-500/10 border-b border-red-500/20 text-red-300"
          : "bg-amber-500/10 border-b border-amber-500/20 text-amber-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        {expired ? (
          <span>Seu teste grátis expirou. Escolha um plano para continuar.</span>
        ) : (
          <span>
            Seu teste grátis termina em <strong>{days} dias</strong>.
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/planos"
          className="rounded-lg bg-primary-neon px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
        >
          Ver planos
        </Link>
        {!expired && (
          <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
