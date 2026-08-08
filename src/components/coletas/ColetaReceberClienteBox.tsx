"use client";

import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import { cn, formatCurrency } from "@/lib/utils";

/** Card “Receber do cliente” — total sobe ao incluir pendência / cai ao descontar haver. */
export function ColetaReceberClienteBox({
  valorOperacao,
  pendenciaSaldo = 0,
  incluirPendencia = false,
  haverSaldo = 0,
  descontarHaver = false,
  className,
}: {
  valorOperacao: number;
  pendenciaSaldo?: number;
  incluirPendencia?: boolean;
  haverSaldo?: number;
  descontarHaver?: boolean;
  className?: string;
}) {
  const { pendenciaIncluida, haverDescontado, totalACobrar } = totalCobrancaNicho({
    valorOperacao,
    pendenciaSaldo,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  });

  const temItens = pendenciaIncluida > 0.009 || haverDescontado > 0.009;

  return (
    <div
      className={cn(
        "rounded-lg border border-primary-neon/35 bg-primary-neon/8 px-4 py-4 space-y-3",
        className
      )}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary-neon/90">
          Receber do cliente
        </p>
        <p className="text-3xl font-bold tabular-nums text-primary-neon mt-1">
          {formatCurrency(totalACobrar)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {haverDescontado > 0.009
            ? "Já descontando haver do ponto"
            : pendenciaIncluida > 0.009
              ? "Inclui pendência anterior nesta cobrança"
              : "Valor desta coleta — informe abaixo quanto recebeu (Pix + dinheiro)"}
        </p>
      </div>

      {temItens && (
        <div className="border-t border-primary-neon/20 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Valor da operação</span>
            <span className="font-medium tabular-nums text-slate-200">
              {formatCurrency(valorOperacao)}
            </span>
          </div>
          {pendenciaIncluida > 0.009 && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Pendência incluída</span>
              <span className="font-medium tabular-nums text-amber-300">
                + {formatCurrency(pendenciaIncluida)}
              </span>
            </div>
          )}
          {haverDescontado > 0.009 && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Haver descontado</span>
              <span className="font-medium tabular-nums text-cyan-300">
                − {formatCurrency(haverDescontado)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
