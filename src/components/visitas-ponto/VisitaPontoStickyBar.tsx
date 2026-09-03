"use client";

import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/** Barra fixa no fim da tela — reforça que a visita ainda não foi cobrada. */
export function VisitaPontoStickyBar({
  acumulado,
  cobrarHref,
  outroNichoHref,
  nichosFeitosLabel,
}: {
  acumulado: number;
  cobrarHref: string;
  outroNichoHref?: string | null;
  nichosFeitosLabel?: string;
}) {
  if (acumulado <= 0.009) return null;

  return (
    <div
      className={
        // Acima da BottomNav (mobile/tablet) + safe-area do sistema; no desktop só um respiro.
        "pointer-events-none fixed inset-x-0 z-40 " +
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] " +
        "lg:bottom-4"
      }
    >
      <div className="pointer-events-auto mx-auto max-w-3xl px-3">
        <div className="rounded-2xl border border-primary-neon/35 bg-[#0b1220]/95 px-3 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-at-muted">
                Ainda não pago
              </p>
              {nichosFeitosLabel ? (
                <p className="truncate text-xs text-at-muted">{nichosFeitosLabel}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-lg font-bold tabular-nums text-white">
              {formatCurrency(acumulado)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {outroNichoHref ? (
              <Link
                href={outroNichoHref}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-at-soft bg-at-card-soft px-3 py-3 text-sm font-semibold text-slate-100 hover:border-white/25"
              >
                Outro nicho
                <ArrowRight className="h-3.5 w-3.5 opacity-70" />
              </Link>
            ) : (
              <Link
                href="#nichos-visita"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-at-soft bg-at-card-soft px-3 py-3 text-sm font-semibold text-slate-100 hover:border-white/25"
              >
                Outro nicho
                <ArrowRight className="h-3.5 w-3.5 opacity-70" />
              </Link>
            )}
            <Link
              href={cobrarHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-neon px-3 py-3 text-sm font-semibold text-black hover:bg-primary-neon/90"
            >
              <Wallet className="h-4 w-4" />
              Cobrar agora
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
