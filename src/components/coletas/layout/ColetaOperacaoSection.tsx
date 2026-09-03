import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ColetaOperacaoSection({
  title,
  subtitle,
  loading,
  loadingLabel = "Carregando...",
  empty,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  loadingLabel?: string;
  empty?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 space-y-3", className)}>
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-at-muted">{subtitle}</p> : null}
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-at-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {loadingLabel}
          </span>
        ) : null}
      </div>
      {empty}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
