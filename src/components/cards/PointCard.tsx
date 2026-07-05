import Link from "next/link";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Ponto } from "@/lib/types/database";
import { MapPin, ChevronRight } from "lucide-react";

interface PointCardProps {
  ponto: Ponto;
}

const statusVariant = {
  ativo: "success" as const,
  pausado: "warning" as const,
  retirado: "default" as const,
  inadimplente: "danger" as const,
};

export function PointCard({ ponto }: PointCardProps) {
  return (
    <Link
      href={`/pontos/${ponto.id}`}
      className="glass-card flex items-center gap-4 p-4 transition hover:border-primary-neon/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-primary-neon">
        <MapPin className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-white truncate">{ponto.nome}</div>
        <p className="text-sm text-slate-400 truncate">
          {[ponto.cidade, ponto.bairro].filter(Boolean).join(" · ") || "Sem localização"}
        </p>
        {ponto.ultima_coleta && (
          <p className="text-xs text-slate-500 mt-0.5">
            Última coleta: {formatDate(ponto.ultima_coleta)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AlertBadge variant={statusVariant[ponto.status]}>
          {ponto.status}
        </AlertBadge>
        <ChevronRight className="h-4 w-4 text-slate-500" />
      </div>
    </Link>
  );
}

export function PointCardCompact({ ponto, faturamento }: { ponto: Ponto; faturamento?: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{ponto.nome}</p>
        <p className="text-xs text-slate-400">{ponto.cidade}</p>
      </div>
      {faturamento !== undefined && (
        <span className="text-sm font-semibold text-green-400">
          {formatCurrency(faturamento)}
        </span>
      )}
    </div>
  );
}
