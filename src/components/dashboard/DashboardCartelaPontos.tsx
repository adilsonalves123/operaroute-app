import {
  labelMotivoCartela,
  mensagemCartela,
  type CartelaPeriodo,
  type CartelaPontos,
} from "@/lib/dashboard-cartela-pontos";
import { cn } from "@/lib/utils";
import { MapPin, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";

function ListaPontos({
  items,
  tipo,
}: {
  items: CartelaPeriodo["captados"];
  tipo: "captado" | "encerrado";
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-600 italic">
        {tipo === "captado" ? "Nenhum captado" : "Nenhum encerrado"}
      </p>
    );
  }

  const visiveis = items.slice(0, 4);
  const restantes = items.length - visiveis.length;

  return (
    <ul className="space-y-1.5">
      {visiveis.map((item) => (
        <li
          key={`${item.id}-${item.data}`}
          className="flex items-center justify-between gap-2 text-xs"
        >
          <span className="truncate text-slate-300">{item.nome}</span>
          {item.motivo && (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                tipo === "captado"
                  ? "bg-green-500/10 text-green-400/90"
                  : "bg-red-500/10 text-red-400/90"
              )}
            >
              {labelMotivoCartela(item.motivo)}
            </span>
          )}
        </li>
      ))}
      {restantes > 0 && (
        <li className="text-[11px] text-slate-600">+{restantes} mais</li>
      )}
    </ul>
  );
}

function ColunaCartela({
  titulo,
  periodo,
}: {
  titulo: string;
  periodo: CartelaPeriodo;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {titulo}
        </p>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            periodo.saldo > 0
              ? "text-green-400"
              : periodo.saldo < 0
                ? "text-red-400"
                : "text-slate-500"
          )}
        >
          {periodo.saldo > 0 && "+"}
          {periodo.saldo === 0 ? "±0" : periodo.saldo}
        </span>
      </div>

      <div className="grid gap-3 min-[480px]:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-green-500/15 bg-green-500/[0.04] p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Plus className="h-3.5 w-3.5 text-green-400" />
              Captados
            </span>
            <span className="text-lg font-bold tabular-nums text-green-400">
              {periodo.captados.length}
            </span>
          </div>
          <ListaPontos items={periodo.captados} tipo="captado" />
        </div>

        <div className="space-y-2 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Minus className="h-3.5 w-3.5 text-red-400" />
              Encerrados
            </span>
            <span className="text-lg font-bold tabular-nums text-red-400">
              {periodo.encerrados.length}
            </span>
          </div>
          <ListaPontos items={periodo.encerrados} tipo="encerrado" />
        </div>
      </div>
    </div>
  );
}

export function DashboardCartelaPontos({ cartela }: { cartela: CartelaPontos }) {
  const semMovimento =
    cartela.semana.captados.length +
      cartela.semana.encerrados.length +
      cartela.mes.captados.length +
      cartela.mes.encerrados.length ===
    0;

  if (semMovimento && cartela.ativosAgora === 0) return null;

  const hint = mensagemCartela(cartela);
  const saldoMes = cartela.mes.saldo;

  return (
    <div className="bank-card flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary-neon" />
            <h3 className="text-sm font-semibold text-white">Base de pontos</h3>
          </div>
          <p className="text-xs text-slate-500 max-w-md leading-relaxed">
            Captados = pontos novos ou reativados · Encerrados = retirados, pausados ou excluídos
          </p>
          <p className="text-sm text-slate-400">{hint}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Ativos agora
          </span>
          <span className="text-2xl font-bold tabular-nums text-white">
            {cartela.ativosAgora}
          </span>
          {saldoMes !== 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                saldoMes > 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {saldoMes > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {saldoMes > 0 && "+"}
              {saldoMes} no mês
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ColunaCartela titulo="Esta semana" periodo={cartela.semana} />
        <ColunaCartela titulo="Este mês" periodo={cartela.mes} />
      </div>
    </div>
  );
}
