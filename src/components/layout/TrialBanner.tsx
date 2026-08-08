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
      className={`relative border-b px-4 py-2.5 sm:px-6 ${
        expired
          ? "border-rose-500/20 bg-[linear-gradient(90deg,rgba(244,63,94,0.12),rgba(10,14,22,0.92)_55%)]"
          : "border-[#c4a574]/20 bg-[linear-gradient(90deg,rgba(196,165,116,0.14),rgba(10,14,22,0.92)_55%)]"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          {expired ? (
            <p className="text-[13px] leading-snug text-rose-100/90 sm:text-[14px]">
              <span
                className="text-[15px] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Avaliação encerrada
              </span>
              <span className="text-rose-200/55"> · </span>
              Escolha um plano para continuar operando.
            </p>
          ) : (
            <p className="text-[13px] leading-snug text-[#e8dfd0]/90 sm:text-[14px]">
              <span
                className="text-[15px] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {plano ? `Trial ${plano}` : "Trial OperaRoute"}
              </span>
              <span className="text-[#c4a574]/55"> · </span>
              {days === 0 ? (
                <span className="text-[#c4a574]">último dia</span>
              ) : (
                <>
                  restam{" "}
                  <span className="tabular-nums text-[#c4a574]">
                    {days} {days === 1 ? "dia" : "dias"}
                  </span>
                </>
              )}
              {limitesLabel ? (
                <span className="hidden text-[#e8dfd0]/55 sm:inline">
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
            className={`rounded-sm px-3 py-1.5 text-[12px] font-medium transition sm:text-[13px] ${
              expired
                ? "border border-rose-300/30 bg-rose-400/15 text-rose-100 hover:bg-rose-400/25"
                : "border border-[#c4a574]/35 bg-[#c4a574]/12 text-[#c4a574] hover:bg-[#c4a574]/20"
            }`}
          >
            {expired ? "Escolher plano" : "Ver planos"}
          </Link>
          {!expired && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-sm p-1.5 text-[#e8dfd0]/40 transition hover:bg-white/[0.04] hover:text-[#f4efe6]"
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
