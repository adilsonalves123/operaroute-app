"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoDiasVencimento } from "@/lib/billing/vencimento";

type Props = {
  dias: number;
  venceEmLabel: string;
  renovacaoCancelada: boolean;
};

export function AssinaturaVencimentoBanner({ dias, venceEmLabel, renovacaoCancelada }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const urgente = dias <= 1;
  const quando = textoDiasVencimento(dias);

  return (
    <div
      className={cn(
        "relative border-b border-at px-4 py-2.5 sm:px-6",
        urgente ? "bg-amber-500/[0.08]" : "bg-at-card-soft"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[13px] leading-snug text-at-muted sm:text-[14px]">
          <CalendarClock
            className={cn("h-4 w-4 shrink-0", urgente ? "text-amber-400" : "text-at-link")}
          />
          <span className="min-w-0">
            {renovacaoCancelada ? (
              <>
                <span className="text-at-primary">Renovação cancelada</span>
                <span className="text-at-soft"> · </span>
                acesso até <span className="tabular-nums text-at-link">{venceEmLabel}</span>
              </>
            ) : (
              <>
                <span className="text-at-primary">Sua assinatura {quando}</span>
                <span className="text-at-soft"> · </span>
                <span className="tabular-nums text-at-link">{venceEmLabel}</span>
                <span className="hidden sm:inline">
                  {" "}
                  — renove para não travar a operação
                </span>
              </>
            )}
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/planos"
            className={cn(
              "rounded-sm border px-3 py-1.5 text-[12px] font-medium transition sm:text-[13px]",
              urgente
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                : "border-at bg-at-card text-at-link hover:border-[var(--at-tab-active-border)] hover:bg-at-card-soft"
            )}
          >
            Renovar
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-sm p-1.5 text-at-soft transition hover:bg-at-card hover:text-at-primary"
            aria-label="Dispensar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
