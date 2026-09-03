import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrialResumo } from "@/lib/onboarding/trial-resumo";

type Props = {
  resumo: TrialResumo;
  className?: string;
  compact?: boolean;
};

/** Card claro: o que os 7 dias grátis liberam (pontos + nichos). */
export function TrialGratisCard({ resumo, className, compact = false }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/90">
            Teste grátis · {resumo.dias} dias
          </p>
          <h2
            className={cn(
              "font-semibold text-white",
              compact ? "text-base" : "text-lg"
            )}
          >
            Aproveite seus {resumo.dias} dias grátis
          </h2>
          <p className="text-sm leading-relaxed text-at-primary/85">
            No trial você usa o plano <strong className="text-white">{resumo.planoNome}</strong>,
            sem cartão:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            <li className="rounded-xl border border-at-soft bg-black/20 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-at-muted">Pontos</p>
              <p className="mt-0.5 font-semibold text-emerald-200">{resumo.labelPontos}</p>
            </li>
            <li className="rounded-xl border border-at-soft bg-black/20 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-at-muted">Nichos</p>
              <p className="mt-0.5 font-semibold text-emerald-200">{resumo.labelNichos}</p>
            </li>
          </ul>
          {resumo.nichosAlemDoTrial > 0 && (
            <p className="text-xs leading-relaxed text-amber-200/90">
              Você marcou mais nichos do que o trial libera. Os{" "}
              {resumo.nichosAlemDoTrial} extras ficam salvos — depois do teste (ou com upgrade)
              dá para ativar.
            </p>
          )}
          {!compact && (
            <p className="text-xs text-at-muted">
              Ao acabar os {resumo.dias} dias, escolha um plano em Planos para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
