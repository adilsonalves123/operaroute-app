import Link from "next/link";
import { Wrench, ChevronRight } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import {
  CHAMADO_PRIORIDADE_LABEL,
  CHAMADO_STATUS_LABEL,
} from "@/lib/chamados/types";
import type { ChamadoResumoPonto } from "@/lib/chamados/resumo";
import { cn } from "@/lib/utils";

type Props = {
  chamados: ChamadoResumoPonto[];
  className?: string;
  compact?: boolean;
};

export function PontoChamadosAlertas({ chamados, className, compact }: Props) {
  if (!chamados.length) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {chamados.map((c) => (
        <div
          key={c.id}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2",
            compact && "py-1.5"
          )}
        >
          <Wrench className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className={cn("text-amber-100/95 font-medium", compact ? "text-xs" : "text-sm")}>
              {c.titulo}
            </p>
            {!compact && c.equipamentos?.nome && (
              <p className="text-[11px] text-amber-200/60 truncate">{c.equipamentos.nome}</p>
            )}
          </div>
          <AlertBadge variant="warning" className="text-[10px] shrink-0">
            {CHAMADO_STATUS_LABEL[c.status]}
          </AlertBadge>
          {(c.prioridade === "alta" || c.prioridade === "urgente") && (
            <AlertBadge variant="danger" className="text-[10px] shrink-0">
              {CHAMADO_PRIORIDADE_LABEL[c.prioridade]}
            </AlertBadge>
          )}
        </div>
      ))}
      <Link
        href="/chamados"
        className="inline-flex items-center gap-0.5 text-[11px] text-amber-400/90 hover:text-amber-300 hover:underline"
      >
        Ver chamados
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
