"use client";

import { Clock, HandCoins } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  haverSaldo: number;
  pendenciaSaldo: number;
  pendenciaColetas?: number;
  descontarHaver: boolean;
  onDescontarHaverChange: (v: boolean) => void;
  incluirPendencia: boolean;
  onIncluirPendenciaChange: (v: boolean) => void;
  /**
   * alertas — banners no topo (como cassino)
   * opcoes — checkboxes no painel de pagamento (como cassino)
   * tudo — ambos (legado)
   */
  variante?: "alertas" | "opcoes" | "tudo";
  /** @deprecated use variante="opcoes" | "tudo" */
  mostrarOpcoesCobranca?: boolean;
  className?: string;
};

/**
 * Alertas + opções alinhados ao Cassino (copy neutra — sem “ganhadores”).
 * - Haver do ponto (cyan)
 * - Pagamento pendente (rose)
 * - Descontar haver / Incluir pendência
 */
export function ColetaHaverPendenciaPanel({
  haverSaldo,
  pendenciaSaldo,
  pendenciaColetas = 0,
  descontarHaver,
  onDescontarHaverChange,
  incluirPendencia,
  onIncluirPendenciaChange,
  variante,
  mostrarOpcoesCobranca = false,
  className,
}: Props) {
  const mode =
    variante ?? (mostrarOpcoesCobranca ? "tudo" : "alertas");
  const showAlertas = mode === "alertas" || mode === "tudo";
  const showOpcoes = mode === "opcoes" || mode === "tudo";

  const temHaver = haverSaldo > 0.009;
  const temPendencia = pendenciaSaldo > 0.009;
  if (!temHaver && !temPendencia) return null;
  if (mode === "opcoes" && !temHaver && !temPendencia) return null;
  if (mode === "alertas" && !temHaver && !temPendencia) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {showAlertas && temHaver && (
        <div className="flex items-center gap-3 rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
            <HandCoins className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              Haver do ponto
            </p>
            <p className="text-xl font-bold tabular-nums text-cyan-300">
              {formatCurrency(haverSaldo)}
            </p>
            <p className="mt-0.5 text-xs text-cyan-400/75">
              Crédito do ponto — abate na cobrança (agora ou no Cobrar)
            </p>
          </div>
        </div>
      )}

      {showAlertas && temPendencia && (
        <div className="rounded-lg border border-rose-500/45 bg-rose-500/12 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20">
              <Clock className="h-5 w-5 text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-400/90">
                Pagamento pendente
              </p>
              <p className="text-xl font-bold tabular-nums text-rose-300">
                {formatCurrency(pendenciaSaldo)}
              </p>
              <p className="mt-0.5 text-xs text-rose-400/75">
                {pendenciaColetas > 0
                  ? `${pendenciaColetas} coleta${pendenciaColetas === 1 ? "" : "s"} anterior${pendenciaColetas === 1 ? "" : "es"} sem quitar — inclui na cobrança quando for receber`
                  : "Dívida de coletas anteriores — inclui na cobrança quando for receber"}
              </p>
            </div>
          </div>
        </div>
      )}

      {showOpcoes && temHaver && (
        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
            descontarHaver
              ? "border-cyan-500/35 bg-cyan-500/5"
              : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600"
          )}
        >
          <input
            type="checkbox"
            checked={descontarHaver}
            onChange={(e) => onDescontarHaverChange(e.target.checked)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <HandCoins className="h-4 w-4 shrink-0 text-cyan-400" />
                Descontar haver nesta cobrança?
              </span>
              <span className="text-sm font-semibold tabular-nums text-cyan-400">
                {formatCurrency(haverSaldo)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Se marcar, o cliente paga menos esse crédito nesta cobrança.
            </p>
          </div>
        </label>
      )}

      {showOpcoes && temPendencia && (
        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
            incluirPendencia
              ? "border-primary-neon/35 bg-primary-neon/5"
              : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600"
          )}
        >
          <input
            type="checkbox"
            checked={incluirPendencia}
            onChange={(e) => onIncluirPendenciaChange(e.target.checked)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                Incluir pendência nesta cobrança
              </span>
              <span className="text-sm font-semibold tabular-nums text-amber-400">
                {formatCurrency(pendenciaSaldo)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Soma ao total a cobrar agora. Se não marcar, o excedente do pagamento ainda pode
              abater a pendência automaticamente.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}

/** Só checkboxes — use no painel direito (ordem cassino: haver → total → pendência). */
export function ColetaOpcoesCobrancaHaver({
  haverSaldo,
  descontarHaver,
  onDescontarHaverChange,
  className,
}: {
  haverSaldo: number;
  descontarHaver: boolean;
  onDescontarHaverChange: (v: boolean) => void;
  className?: string;
}) {
  if (haverSaldo <= 0.009) return null;
  return (
    <ColetaHaverPendenciaPanel
      haverSaldo={haverSaldo}
      pendenciaSaldo={0}
      descontarHaver={descontarHaver}
      onDescontarHaverChange={onDescontarHaverChange}
      incluirPendencia={false}
      onIncluirPendenciaChange={() => {}}
      variante="opcoes"
      className={className}
    />
  );
}

export function ColetaOpcoesCobrancaPendencia({
  pendenciaSaldo,
  incluirPendencia,
  onIncluirPendenciaChange,
  className,
}: {
  pendenciaSaldo: number;
  incluirPendencia: boolean;
  onIncluirPendenciaChange: (v: boolean) => void;
  className?: string;
}) {
  if (pendenciaSaldo <= 0.009) return null;
  return (
    <ColetaHaverPendenciaPanel
      haverSaldo={0}
      pendenciaSaldo={pendenciaSaldo}
      descontarHaver={false}
      onDescontarHaverChange={() => {}}
      incluirPendencia={incluirPendencia}
      onIncluirPendenciaChange={onIncluirPendenciaChange}
      variante="opcoes"
      className={className}
    />
  );
}
