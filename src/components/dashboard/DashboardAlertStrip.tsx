import Link from "next/link";
import { AlertTriangle, ChevronRight, Wrench } from "lucide-react";

interface DashboardAlertsProps {
  pontosSemColeta: number;
  chamadosAbertos?: number;
}

export function DashboardAlerts({ pontosSemColeta, chamadosAbertos = 0 }: DashboardAlertsProps) {
  if (pontosSemColeta <= 0 && chamadosAbertos <= 0) return null;

  return (
    <div className="space-y-2">
      {chamadosAbertos > 0 && (
        <Link
          href="/chamados"
          className="group flex items-center gap-3 rounded-lg border border-orange-500/35 bg-orange-500/10 px-4 py-3 transition hover:border-orange-500/50 hover:bg-orange-500/15"
        >
          <Wrench className="h-4 w-4 shrink-0 text-orange-400/90" />
          <p className="min-w-0 flex-1 text-sm text-orange-100/90">
            <span className="font-medium tabular-nums">{chamadosAbertos}</span>
            {chamadosAbertos === 1
              ? " chamado de manutenção em aberto"
              : " chamados de manutenção em aberto"}
          </p>
          <span className="flex items-center gap-0.5 text-xs text-primary-neon group-hover:underline">
            Ver alertas
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      {pontosSemColeta > 0 && (
        <Link
          href="/pontos?filtro=sem_coleta"
          className="group flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 transition hover:border-amber-500/45 hover:bg-amber-500/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400/90" />
          <p className="min-w-0 flex-1 text-sm text-amber-100/90">
            <span className="font-medium tabular-nums">{pontosSemColeta}</span>
            {pontosSemColeta === 1 ? " ponto" : " pontos"} sem coleta há mais de 7 dias
          </p>
          <span className="flex items-center gap-0.5 text-xs text-primary-neon group-hover:underline">
            Ver pontos
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}
    </div>
  );
}

/** @deprecated use DashboardAlerts */
export function DashboardAlertStrip(props: DashboardAlertsProps) {
  return <DashboardAlerts {...props} />;
}
