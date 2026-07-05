import { mensagemPulso, type PulsoOperacao } from "@/lib/dashboard-pulso";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, Zap } from "lucide-react";

function IndiceRing({ valor }: { valor: number | null }) {
  if (valor === null) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-slate-900/50">
        <span className="text-lg text-slate-600">—</span>
      </div>
    );
  }

  const cor =
    valor >= 75 ? "text-primary-neon" : valor >= 50 ? "text-amber-400" : "text-red-400";
  const border =
    valor >= 75
      ? "border-primary-neon/40 shadow-[0_0_24px_rgba(0,212,255,0.12)]"
      : valor >= 50
        ? "border-amber-500/35"
        : "border-red-500/35";

  return (
    <div
      className={cn(
        "flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-2 bg-slate-900/60",
        border
      )}
    >
      <span className={cn("text-2xl font-bold tabular-nums leading-none", cor)}>
        {valor.toFixed(0)}%
      </span>
    </div>
  );
}

function BarraImpulso({ impulsos, pressoes }: { impulsos: number; pressoes: number }) {
  const total = impulsos + pressoes;
  if (total <= 0) {
    return <div className="h-2 rounded-full bg-slate-800" />;
  }
  const pctImpulso = (impulsos / total) * 100;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-red-500/25">
      <div
        className="h-full rounded-full bg-green-500/80 transition-all"
        style={{ width: `${pctImpulso}%` }}
      />
    </div>
  );
}

function ColunaPeriodo({
  titulo,
  impulsos,
  pressoes,
  indice,
}: {
  titulo: string;
  impulsos: number;
  pressoes: number;
  indice: number | null;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {titulo}
        </p>
        {indice !== null && (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              indice >= 65 ? "text-green-400" : indice >= 45 ? "text-amber-400" : "text-red-400"
            )}
          >
            {indice.toFixed(0)}%
          </span>
        )}
      </div>

      <div className="grid gap-3 min-[480px]:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-green-500/15 bg-green-500/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-green-400" />
              Impulsos
            </span>
            <span className="text-lg font-bold tabular-nums text-green-400">{impulsos}</span>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-red-400" />
              Pressões
            </span>
            <span className="text-lg font-bold tabular-nums text-red-400">{pressoes}</span>
          </div>
        </div>
      </div>

      <BarraImpulso impulsos={impulsos} pressoes={pressoes} />
    </div>
  );
}

export function DashboardPulso({ pulso }: { pulso: PulsoOperacao }) {
  const indiceExibido = pulso.semana.indice ?? pulso.mes.indice;
  const hint = mensagemPulso(pulso);
  const semDados =
    pulso.semana.impulsos + pulso.semana.pressoes + pulso.mes.impulsos + pulso.mes.pressoes === 0;

  if (semDados && pulso.totalEventos === 0) return null;

  return (
    <div className="bank-card flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <IndiceRing valor={indiceExibido} />
          <div className="min-w-0 space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-primary-neon" />
              <h3 className="text-sm font-semibold text-white">Pulso da operação</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Impulsos = visitas com lucro · Pressões = prejuízo no ponto
            </p>
            <p className="text-sm text-slate-400">{hint}</p>
            {pulso.deltaSemanaPontos !== null && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  pulso.deltaSemanaPontos > 0.009
                    ? "bg-green-500/10 text-green-400"
                    : pulso.deltaSemanaPontos < -0.009
                      ? "bg-red-500/10 text-red-400"
                      : "bg-slate-800 text-slate-400"
                )}
              >
                {pulso.deltaSemanaPontos > 0.009 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : pulso.deltaSemanaPontos < -0.009 ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {pulso.deltaSemanaPontos > 0.009 && "+"}
                {pulso.deltaSemanaPontos.toFixed(1).replace(".", ",")} p.p. vs semana passada
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-6 sm:grid-cols-2">
        <ColunaPeriodo
          titulo="Esta semana"
          impulsos={pulso.semana.impulsos}
          pressoes={pulso.semana.pressoes}
          indice={pulso.semana.indice}
        />
        <ColunaPeriodo
          titulo="Este mês"
          impulsos={pulso.mes.impulsos}
          pressoes={pulso.mes.pressoes}
          indice={pulso.mes.indice}
        />
      </div>

      {indiceExibido !== null && (
        <p className="mt-4 border-t border-blue-500/10 pt-3 text-[11px] text-slate-600">
          Índice de tração:{" "}
          <span className="text-slate-400">
            {indiceExibido.toFixed(0)}% das visitas com resultado favorável
          </span>
          {pulso.mes.neutros + pulso.semana.neutros > 0 && (
            <span className="text-slate-600"> · visitas zeradas não entram na conta</span>
          )}
        </p>
      )}
    </div>
  );
}
