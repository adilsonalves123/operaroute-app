"use client";

import { calcularRecebimentoComPendencia } from "@/lib/nichos/fura-fura/recebimento-pendencia";
import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import type { CalculoColetaDiversao } from "@/lib/nichos/diversao";
import type { ResumoPendenciaPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";
import {
  ColetaOpcoesCobrancaHaver,
  ColetaOpcoesCobrancaPendencia,
} from "@/components/coletas/ColetaHaverPendenciaPanel";
import { ColetaReceberClienteBox } from "@/components/coletas/ColetaReceberClienteBox";
import { ColetaContinuarPagamentoHint } from "@/components/coletas/ColetaContinuarPagamentoHint";
import { ColetaRecebimentoFields } from "@/components/coletas/layout";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";
import { cn, formatCurrency } from "@/lib/utils";

type RecebimentoFields = {
  desconto: string;
  pix: string;
  dinheiro: string;
  onDescontoChange: (value: string) => void;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
};

export function ColetaDiversaoResumo({
  calculo,
  className,
  pendenciaPonto,
  haverSaldo = 0,
  descontarHaver = false,
  onDescontarHaverChange,
  incluirPendencia = false,
  onIncluirPendenciaChange,
  recebimento,
  modoVisitaPonto = false,
  receberAgora = false,
  finalizarSemPagar = false,
  modoFecharSlot,
}: {
  calculo: CalculoColetaDiversao;
  className?: string;
  pendenciaPonto?: ResumoPendenciaPonto | null;
  haverSaldo?: number;
  descontarHaver?: boolean;
  onDescontarHaverChange?: (v: boolean) => void;
  incluirPendencia?: boolean;
  onIncluirPendenciaChange?: (v: boolean) => void;
  recebimento: RecebimentoFields;
  modoVisitaPonto?: boolean;
  receberAgora?: boolean;
  finalizarSemPagar?: boolean;
  modoFecharSlot?: React.ReactNode;
}) {
  const mostrandoPagamento = !modoVisitaPonto || receberAgora;
  const pendenciaSaldo = pendenciaPonto?.totalPendente ?? 0;

  const cobranca = totalCobrancaNicho({
    valorOperacao: calculo.valorAReceber,
    pendenciaSaldo,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  });

  const recebimentoCalculado =
    mostrandoPagamento && calculo.valorPagoRecebido > 0.009
      ? calcularRecebimentoComPendencia(
          cobranca.valorOperacao - cobranca.haverDescontado,
          calculo.valorPagoRecebido,
          pendenciaSaldo
        )
      : null;

  const faltaCobranca = Math.max(0, cobranca.totalACobrar - calculo.valorPagoRecebido);
  const hint =
    incluirPendencia && pendenciaSaldo > 0.009
      ? "Valor acima quita a dívida anterior do ponto."
      : "Zero = saldo fica pendente para cobrar depois.";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/10 to-transparent p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80">
          {modoVisitaPonto && !mostrandoPagamento
            ? "Valor desta operação"
            : mostrandoPagamento
              ? "Valor da operação"
              : "A receber nesta coleta"}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-cyan-200">
          {formatCurrency(calculo.valorAReceber)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Lucro real:{" "}
          <span className="font-medium text-green-400">{formatCurrency(calculo.lucroReal)}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          {calculo.maquinas.length} máq.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-slate-500">Bruto</span>
        <span className="text-right tabular-nums text-slate-200">{formatCurrency(calculo.valorBruto)}</span>
        <span className="text-slate-500">Comissão</span>
        <span className="text-right tabular-nums text-amber-300">{formatCurrency(calculo.valorComissao)}</span>
        {calculo.desconto > 0.009 && (
          <>
            <span className="text-slate-500">Desconto</span>
            <span className="text-right tabular-nums text-rose-300">− {formatCurrency(calculo.desconto)}</span>
          </>
        )}
      </div>

      <ComissaoStaffLinha lucroAposBrindes={calculo.lucroReal} />

      {modoVisitaPonto && modoFecharSlot}

      {recebimento && mostrandoPagamento ? (
        <div className="space-y-3">
          {onDescontarHaverChange && (
            <ColetaOpcoesCobrancaHaver
              haverSaldo={haverSaldo}
              descontarHaver={descontarHaver}
              onDescontarHaverChange={onDescontarHaverChange}
            />
          )}

          <ColetaReceberClienteBox
            valorOperacao={calculo.valorAReceber}
            pendenciaSaldo={pendenciaSaldo}
            incluirPendencia={incluirPendencia}
            haverSaldo={haverSaldo}
            descontarHaver={descontarHaver}
          />

          {onIncluirPendenciaChange && (
            <ColetaOpcoesCobrancaPendencia
              pendenciaSaldo={pendenciaSaldo}
              incluirPendencia={incluirPendencia}
              onIncluirPendenciaChange={onIncluirPendenciaChange}
            />
          )}

          <ColetaRecebimentoFields
            {...recebimento}
            hint={
              modoVisitaPonto
                ? "Recebe esta coleta agora. O que faltar (e outros nichos) fica no Cobrar."
                : hint
            }
            status={
              calculo.valorPagoRecebido > 0.009
                ? {
                    valorPago: calculo.valorPagoRecebido,
                    saldoPendente: faltaCobranca,
                    haver: recebimentoCalculado?.haver ?? 0,
                    quitado: faltaCobranca <= 0.009,
                  }
                : null
            }
          />
        </div>
      ) : recebimento && modoVisitaPonto ? (
        <div className="space-y-3">
          {finalizarSemPagar ? (
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-3 text-xs text-slate-400">
              Fecha a visita sem cobrar agora. O saldo fica{" "}
              <strong className="text-cyan-300">pendente</strong>.
            </div>
          ) : (
            <>
              <ColetaRecebimentoFields
                {...recebimento}
                somenteDesconto
                hint="Desconto só desta operação (opcional)."
              />
              <ColetaContinuarPagamentoHint />
            </>
          )}
        </div>
      ) : calculo.valorPagoRecebido > 0.009 ? (
        <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Recebimento
          </p>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Recebido</span>
            <span className="font-semibold text-green-400 tabular-nums">
              {formatCurrency(calculo.valorPagoRecebido)}
            </span>
          </div>
          {calculo.saldoPendente > 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-amber-300">Pendente</span>
              <span className="font-bold text-amber-400 tabular-nums">
                {formatCurrency(calculo.saldoPendente)}
              </span>
            </div>
          ) : calculo.haver > 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-cyan-300">Haver</span>
              <span className="font-bold text-cyan-400 tabular-nums">
                + {formatCurrency(calculo.haver)}
              </span>
            </div>
          ) : (
            <p className="text-green-400">Quitado</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
