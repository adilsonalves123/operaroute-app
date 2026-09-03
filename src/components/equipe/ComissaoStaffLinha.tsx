"use client";

import { calcComissaoStaff, clampComissaoPercentual } from "@/lib/equipe/comissao-staff";
import { usePermissoes } from "@/components/layout/PermissoesProvider";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Mostra ganho do operador/gerente sobre lucro após brindes.
 * Uso interno apenas — não incluir em relatórios/WhatsApp do cliente.
 */
export function ComissaoStaffLinha({
  lucroAposBrindes,
  percentual,
  className,
  compact = false,
}: {
  /** Base = lucro_real (valor a receber − custo dos brindes). Cassino: valor_operacao. */
  lucroAposBrindes: number;
  /** Se omitido, usa a % do usuário logado (Equipe). */
  percentual?: number | null;
  className?: string;
  compact?: boolean;
}) {
  const { comissaoPercentual, isOwner, role } = usePermissoes();
  const pct = clampComissaoPercentual(
    percentual != null ? percentual : comissaoPercentual
  );
  if (pct <= 0) return null;

  const valor = calcComissaoStaff(lucroAposBrindes, pct);
  const alheio =
    percentual != null &&
    Math.abs(percentual - comissaoPercentual) > 0.001 &&
    (isOwner || role === "admin" || role === "gerente");
  const titulo = alheio ? "Comissão do operador" : "Sua comissão";

  if (compact) {
    return (
      <p className={cn("text-xs text-violet-300/90", className)}>
        {titulo} ({pct}%):{" "}
        <span className="font-semibold tabular-nums text-violet-200">
          {formatCurrency(valor)}
        </span>
        <span className="text-at-soft"> · após brindes</span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
            {titulo} ({pct}%)
          </p>
          <p className="mt-0.5 text-[11px] text-at-muted">
            Sobre o lucro depois do custo dos brindes
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums text-violet-200">
          {formatCurrency(valor)}
        </p>
      </div>
    </div>
  );
}
