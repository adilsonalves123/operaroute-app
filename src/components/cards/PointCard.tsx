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
    className: "text-emerald-400/90 border-emerald-500/25 bg-emerald-500/[0.06]",
  },
  pausado: {
    label: "Pausado",
    className: "text-amber-300/90 border-amber-500/25 bg-amber-500/[0.06]",
  },
  retirado: {
    label: "Retirado",
    className: "text-slate-400 border-white/10 bg-white/[0.03]",
  },
  inadimplente: {
    label: "Inadimplente",
    className: "text-rose-300/90 border-rose-500/25 bg-rose-500/[0.06]",
  },
};

export function PointCard({ ponto }: PointCardProps) {
  const status = STATUS_STYLE[ponto.status] ?? STATUS_STYLE.ativo;
  const local =
    [ponto.cidade, ponto.bairro].filter(Boolean).join(" · ") || "Sem localização";

  return (
    <Link
      href={`/pontos/${ponto.id}`}
      className="group flex items-center gap-4 py-4 transition [content-visibility:auto] [contain-intrinsic-size:auto_88px] hover:bg-white/[0.02] sm:gap-5"
    >
      {(ponto.foto_url ?? "").trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ponto.foto_url!}
          alt={ponto.nome}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 shrink-0 rounded-sm object-cover border border-white/[0.08] bg-[#0c1018]"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-white/[0.08] bg-white/[0.03] text-[#c4a574]/70">
          <MapPin className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="truncate text-[15px] font-medium text-[#f4efe6] transition group-hover:text-white">
            {ponto.nome}
          </p>
          <span
            className={cn(
              "inline-flex rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-slate-500">{local}</p>
        {ponto.ultima_coleta && (
          <p className="mt-0.5 text-[11px] tabular-nums text-slate-600">
            Última coleta · {formatDate(ponto.ultima_coleta)}
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-[#c4a574]/80" />
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
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#f4efe6]">{ponto.nome}</p>
        <p className="truncate text-xs text-slate-500">{ponto.cidade}</p>
      </div>
      {faturamento !== undefined && (
        <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-400/90">
          {formatCurrency(faturamento)}
        </span>
      )}
    </div>
  );
}
