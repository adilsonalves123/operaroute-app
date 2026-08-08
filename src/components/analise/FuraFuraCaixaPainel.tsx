"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Gift, Minus, Wallet } from "lucide-react";
import type { FuraFuraCaixaMes } from "@/lib/analise/inteligencia-operacional";

export function FuraFuraCaixaPainel({
  caixa,
  compact = false,
  className,
  periodoLabel = "mês",
  titulo = "Caixa da operação",
  descricao = "O que entrou pra você — já descontada a comissão do cliente",
}: {
  caixa: FuraFuraCaixaMes;
  compact?: boolean;
  className?: string;
  periodoLabel?: string;
  titulo?: string;
  descricao?: string;
}) {
  const pctReserva =
    caixa.dinheiroOperacao > 0
      ? Math.round((caixa.reservaBrindes / caixa.dinheiroOperacao) * 100)
      : 0;
  const comissao = Math.max(0, caixa.brutoMaquina - caixa.dinheiroOperacao);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-primary-neon/20 bg-gradient-to-br from-primary-neon/[0.06] via-transparent to-transparent",
        className
      )}
    >
      <div className={cn("p-5", compact && "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
              {titulo} · {periodoLabel}
            </p>
            <p className="mt-1 text-sm text-slate-400">{descricao}</p>
          </div>
          <Wallet className="h-5 w-5 shrink-0 text-primary-neon/60" />
        </div>

        <p className={cn("mt-4 font-bold tabular-nums text-white", compact ? "text-2xl" : "text-3xl")}>
          {formatCurrency(caixa.dinheiroOperacao)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Lucro líquido recebido das coletas (após comissão)
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-slate-500">Entrada</p>
            <p className="mt-0.5 font-semibold tabular-nums text-emerald-400/90">
              {formatCurrency(caixa.brutoMaquina)}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-slate-500">Comissão</p>
            <p className="mt-0.5 font-semibold tabular-nums text-amber-300/90">
              {formatCurrency(comissao)}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-slate-500">Brindes</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-300">
              {formatCurrency(caixa.reservaBrindes)}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-amber-300/90">
              <Gift className="h-3.5 w-3.5" />
              Reserva p/ repor brindes
            </span>
            <span className="font-semibold tabular-nums text-amber-400">
              <Minus className="mr-0.5 inline h-3 w-3" />
              {formatCurrency(caixa.reservaBrindes)}
            </span>
          </div>
          {pctReserva > 0 && (
            <p className="text-[11px] text-slate-500">
              {pctReserva}% do caixa vai para recomprar prêmios entregues
            </p>
          )}

          <div className="border-t border-white/[0.08] pt-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-green-400/90">
                  Lucro líquido livre
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  O que fica no bolso depois de reservar brindes
                </p>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  caixa.lucroLivre >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {formatCurrency(caixa.lucroLivre)}
              </p>
            </div>
          </div>
        </div>

        {(caixa.recebido > 0 || caixa.pendenteReceber > 0.009 || caixa.haver > 0.009) && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Já recebido:{" "}
              <strong className="text-slate-300">{formatCurrency(caixa.recebido)}</strong>
            </span>
            {caixa.pendenteReceber > 0.009 && (
              <span>
                Falta receber:{" "}
                <strong className="text-amber-400">{formatCurrency(caixa.pendenteReceber)}</strong>
              </span>
            )}
            {caixa.haver > 0.009 && (
              <span>
                Haver do ponto:{" "}
                <strong className="text-cyan-400">+{formatCurrency(caixa.haver)}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
