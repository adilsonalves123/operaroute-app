"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import {
  type AcessoAssinaturaInput,
  diasRestantesTrial,
  estaEmTrial,
  temPagamentoValido,
  trialExpirado,
  trialFimEfetivoIso,
} from "@/lib/assinatura-acesso";
import { cn } from "@/lib/utils";

interface TrialBannerProps {
  acesso: AcessoAssinaturaInput;
  /** Ex.: "até 50 pontos · até 3 nichos" */
  limitesLabel?: string | null;
  planoNome?: string | null;
}

export function TrialBanner({
  acesso,
  limitesLabel = null,
  planoNome = null,
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || temPagamentoValido(acesso)) return null;

  const trialFim = trialFimEfetivoIso(acesso);
  if (!trialFim) return null;

  const emTrial = estaEmTrial(acesso);
  const expired = trialExpirado(acesso);
  if (!emTrial && !expired) return null;

  const days = diasRestantesTrial(trialFim);
  const plano = planoNome?.trim() || null;

  return (
    <div
      className={cn(
        "relative border-b border-at px-4 py-2.5 sm:px-6",
        expired ? "bg-red-500/[0.06]" : "bg-at-card-soft"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          {expired ? (
            <p className="text-[13px] leading-snug text-at-muted sm:text-[14px]">
              <span
                className="text-[15px] tracking-tight text-at-primary"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Avaliação encerrada
              </span>
              <span className="text-at-soft"> · </span>
              Escolha um plano para continuar operando.
            </p>
          ) : (
            <p className="text-[13px] leading-snug text-at-muted sm:text-[14px]">
              <span
                className="text-[15px] tracking-tight text-at-primary"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {plano ? `Trial ${plano}` : "Trial OperaRoute"}
              </span>
              <span className="text-at-soft"> · </span>
              {days === 0 ? (
                <span className="text-at-link">último dia</span>
              ) : (
                <>
                  restam{" "}
                  <span className="tabular-nums text-at-link">
                    {days} {days === 1 ? "dia" : "dias"}
                  </span>
                </>
              )}
              {limitesLabel ? (
                <span className="hidden text-at-soft sm:inline">
                  {" "}
                  · {limitesLabel}
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/planos"
            className={cn(
              "rounded-sm border px-3 py-1.5 text-[12px] font-medium transition sm:text-[13px]",
              expired
                ? "border-red-500/30 bg-at-card text-at-money-neg hover:bg-red-500/10"
                : "border-at bg-at-card text-at-link hover:border-[var(--at-tab-active-border)] hover:bg-at-card-soft"
            )}
          >
            {expired ? "Escolher plano" : "Ver planos"}
          </Link>
          {!expired && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-sm p-1.5 text-at-soft transition hover:bg-at-card hover:text-at-primary"
              aria-label="Dispensar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
