"use client";

import { CheckCircle2, ArrowRight, X } from "lucide-react";

/**
 * Após receber o pagamento deste nicho: encerrar a visita inteira
 * ou seguir cobrando / coletando nos demais.
 */
export function ReceberVisitaDecisaoDialog({
  onEncerrar,
  onContinuar,
  onCancelar,
}: {
  onEncerrar: () => void;
  onContinuar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receber-visita-decisao-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1524] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="receber-visita-decisao-titulo"
              className="text-base font-semibold text-white sm:text-lg"
            >
              Pagamento deste nicho
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              O valor deste nicho será recebido agora. Deseja finalizar e encerrar a
              visita, ou continuar com os outros nichos?
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onContinuar}
            className="flex w-full items-start gap-3 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3.5 text-left transition hover:bg-cyan-500/15"
          >
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              <span className="block text-sm font-semibold text-cyan-50">
                Continuar com outros nichos
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-slate-400">
                Este nicho fica pago e fora da cobrança. A visita segue aberta para os
                que restam.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onEncerrar}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition hover:bg-white/[0.07]"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Finalizar e encerrar a visita
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-slate-400">
                Fecha a visita agora. Nichos ainda sem pagamento ficam como pendência.
              </span>
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className="mt-4 w-full py-2 text-center text-sm text-slate-500 transition hover:text-slate-300"
        >
          Voltar sem salvar
        </button>
      </div>
    </div>
  );
}
