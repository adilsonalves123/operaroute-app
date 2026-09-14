import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Ponto } from "@/lib/types/database";

interface PointCardProps {
  ponto: Ponto;
}

const STATUS_STYLE: Record<
  Ponto["status"],
  { label: string; className: string }
> = {
  ativo: {
    label: "Ativo",
    className: "badge-ponto-ativo border",
  },
  pausado: {
    label: "Pausado",
    className: "badge-ponto-pausado border",
  },
  retirado: {
    label: "Retirado",
    className: "text-at-muted border-at-soft bg-at-card-soft border",
  },
  inadimplente: {
    label: "Inadimplente",
    className: "badge-ponto-inadimplente border",
  },
};

export function PointCard({ ponto }: PointCardProps) {
  const status = STATUS_STYLE[ponto.status] ?? STATUS_STYLE.ativo;
  const local =
    [ponto.cidade, ponto.bairro].filter(Boolean).join(" · ") || "Sem localização";

  return (
    <Link
      href={`/pontos/${ponto.id}`}
      className="group flex items-center gap-4 px-3 py-4 transition [content-visibility:auto] [contain-intrinsic-size:auto_88px] hover:bg-at-card-soft sm:gap-5 sm:px-4"
    >
      {(ponto.foto_url ?? "").trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ponto.foto_url!}
          alt={ponto.nome}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 shrink-0 rounded-sm border border-at-soft bg-at-card-soft object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-at-soft bg-at-card-soft text-at-link">
          <MapPin className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="truncate text-[15px] font-medium text-at-primary transition group-hover:text-at-link">
            {ponto.nome}
          </p>
          <span
            className={cn(
              "inline-flex rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-at-muted">{local}</p>
        {ponto.ultima_coleta && (
          <p className="mt-0.5 text-[11px] tabular-nums text-at-soft">
            Última coleta · {formatDate(ponto.ultima_coleta)}
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-at-soft transition group-hover:text-at-link/80" />
    </Link>
  );
}

export function PointCardCompact({
  ponto,
  faturamento,
}: {
  ponto: Ponto;
  faturamento?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-at-soft py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-at-primary">{ponto.nome}</p>
        <p className="truncate text-xs text-at-muted">{ponto.cidade}</p>
      </div>
      {faturamento !== undefined && (
        <span className="shrink-0 text-sm font-medium tabular-nums text-at-money-pos">
          {formatCurrency(faturamento)}
        </span>
      )}
    </div>
  );
}
